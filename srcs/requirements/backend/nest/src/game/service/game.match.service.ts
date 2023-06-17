import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Namespace, Socket } from "socket.io";
import { User } from "src/user/entity/user.entity";
import { UserService } from "src/user/service/user.service";
import { Repository } from "typeorm";
import {
  customRoomInfo,
  GameResultResponse,
  roomSecretInfo,
} from "../dto/game.dto";
import { GameResult } from "../entity/game.entity";
import { GameRoomService } from "./game.room.service";

@Injectable()
export class GameMatchService {
  private queue: Socket[] = [];
  private rooms: customRoomInfo[] = [];
  private roomSecrets: roomSecretInfo[] = [];
  private roomNumber = 1;

  constructor(
    private GameRoomService: GameRoomService,
    private userService: UserService,
    @InjectRepository(GameResult)
    private gameResultRepository: Repository<GameResult>
  ) {
    setInterval(this.handleLadderMatch.bind(this), 1000);
  }

  changeMode(roomInfo: { roomId: number; newMode: boolean }): void {
    const roomIndex = this.rooms.findIndex(
      (room) => room.roomId === roomInfo.roomId
    );
    if (roomIndex !== -1) {
      const roomSecret = this.roomSecrets[roomIndex];
      if (roomSecret.participant) {
        roomSecret.participant.emit("change-mode", roomInfo.newMode);
      }
    }
  }

  async createCustomGame(
    client: Socket,
    roomInfo: {
      title: string;
      password: string | null;
    }
  ): Promise<void> {
    const roomId = this.roomNumber++;
    const { id: masterId } = await this.userService.findBySocketId(client.id);
    const room: customRoomInfo = {
      roomId,
      title: roomInfo.title,
      isLocked: !!roomInfo.password,
      isPrivate: false,
      masterId,
      participantId: undefined,
    };
    this.rooms.push(room);
    const roomSecret: roomSecretInfo = {
      roomId,
      master: client,
      participant: null,
      password: roomInfo.password,
    };
    this.roomSecrets.push(roomSecret);
    client.emit("custom-room-created", room);
  }

  getCustomGameList(client: Socket): void {
    const room: customRoomInfo[] = this.rooms;
    client.emit("custom-room-list", room);
  }

  //destroy, exit logic
  exitCustomGame(client: Socket, roomId: number): void {
    const roomIndex = this.rooms.findIndex((room) => room.roomId === roomId);
    if (roomIndex !== -1) {
      const room = this.rooms[roomIndex];
      const roomSecret = this.roomSecrets[roomIndex];
      if (roomSecret.master === client) {
        this.rooms.splice(roomIndex, 1);
        this.roomSecrets.splice(roomIndex, 1);
        if (roomSecret.participant)
          roomSecret.participant.emit("room-destroyed");
      } else {
        room.participantId = undefined;
        roomSecret.master.emit("user-exit", room);
      }
    } else {
      console.log("Room not found");
    }
  }

  async customGameStart(
    client: Socket,
    roomInfo: {
      roomId: number;
      mode: boolean;
    }
  ): Promise<void> {
    const roomIndex = this.rooms.findIndex(
      (room) => room.roomId === roomInfo.roomId
    );
    const roomSecret = this.roomSecrets[roomIndex];
    if (!roomSecret?.participant) return;
    await this.GameRoomService.createRoom(
      roomSecret.master,
      roomSecret.participant,
      roomInfo.mode,
      false
    );
    this.rooms.splice(roomIndex, 1);
    this.roomSecrets.splice(roomIndex, 1);
  }

  async joinCustomGame(
    client: Socket,
    roomInfo: {
      roomId: number;
      password: string | null;
    }
  ): Promise<void> {
    const roomIndex = this.rooms.findIndex(
      (room) => room.roomId === roomInfo.roomId
    );
    const { id: participantId } = await this.userService.findBySocketId(
      client.id
    );
    if (roomIndex !== -1) {
      const room = this.rooms[roomIndex];
      const roomSecret = this.roomSecrets[roomIndex];
      if (room.participantId !== undefined) {
        client.emit("room-full", roomInfo.roomId);
      } else if (roomSecret.password === roomInfo.password) {
        room.participantId = participantId;
        roomSecret.participant = client;
        roomSecret.master.emit("user-join", room);
        client.emit("user-join", room);
      } else {
        client.emit("wrong-password", roomInfo.roomId);
      }
    }
  }

  isDisconnectedSocket(player1: Socket, player2: Socket): boolean {
    if (
      player1.disconnected === undefined &&
      player2.disconnected === undefined
    ) {
      this.queue.splice(0, 2);
      return true;
    } else if (player2.disconnected === undefined) {
      this.queue.splice(1, 1);
      return true;
    } else if (player1.disconnected === undefined) {
      this.queue.splice(0, 1);
      return true;
    }
    if (player1.disconnected && player2.disconnected) {
      this.queue.splice(0, 2);
      return true;
    } else if (player2.disconnected) {
      this.queue.splice(1, 1);
      return true;
    } else if (player1.disconnected) {
      this.queue.splice(0, 1);
      return true;
    }
    return false;
  }

  async handleLadderMatch() {
    let length = this.queue.length;
    while (length >= 2) {
      const player1 = this.queue[0];
      const player2 = this.queue[1];
      if (await this.isDisconnectedSocket(player1, player2)) continue;
      await this.GameRoomService.createRoom(player1, player2, false, true);
      this.queue.splice(0, 2);
      length = this.queue.length;
    }
  }

  async handleInviteCheck(
    master: User,
    participant: User,
    server: Namespace
  ): Promise<boolean> {
    if (participant.status === "game") {
      server.to(master.gameSocketId).emit("participant-already-ingame");
      return true;
    } else if (participant.status === "offline") {
      server.to(master.gameSocketId).emit("participant-offline");
    }
    for (let i = 0; i < this.rooms.length; i++) {
      if (
        this.rooms[i].masterId === master.id ||
        this.rooms[i].participantId === participant.id
      ) {
        server.to(master.gameSocketId).emit("participant-already-ingame");
        return true;
      }
    }
    return false;
  }

  async handleInviteGame(
    client: Socket,
    opponent: number,
    server: Namespace
  ): Promise<void> {
    const master = await this.userService.findBySocketId(client.id);
    const participant: User = await this.userService.findOneOrFail(opponent);
    if (await this.handleInviteCheck(master, participant, server)) {
      return;
    }
    const roomId = this.roomNumber++;
    const room: customRoomInfo = {
      roomId,
      title: `${master.nickname}'s game`,
      isLocked: false,
      isPrivate: true,
      masterId: master.id,
      participantId: undefined,
    };
    this.rooms.push(room);
    const roomSecret: roomSecretInfo = {
      roomId,
      master: client,
      participant: null,
      password: null,
    };
    this.roomSecrets.push(roomSecret);
    server.to(participant.gameSocketId).emit("invited-user", {
      master: master.nickname,
      roomId,
    });
    client.emit("invite-room-created", room);
  }

  async handleInviteFail(client: Socket, roomId: number, server: Namespace) {
    const roomIndex = this.rooms.findIndex((room) => room.roomId === roomId);
    const user = await this.userService.findOneOrFail(
      this.rooms[roomIndex].masterId
    );
    this.rooms.splice(roomId, 1);
    this.roomSecrets.splice(roomId, 1);
    server.to(user.gameSocketId).emit("invite-dismissed");
  }

  handleLadderMatchStart(client: Socket): void {
    if (this.queue.find((queue) => queue === client) === undefined) {
      this.queue.push(client);
    }
  }

  handleLadderMatchcancel(client: Socket): void {
    const index = this.queue.findIndex((queue) => queue === client);
    if (index !== -1 || this.queue[index].disconnected) {
      this.queue.splice(index, 1);
    }
  }

  async handleFindMatches(
    userId: number,
    client: Socket
  ): Promise<GameResultResponse[]> {
    const matches: GameResult[] = await this.gameResultRepository.find({
      relations: {
        winner: true,
        loser: true,
      },
      where: [
        {
          winner: {
            id: userId,
          },
        },
        {
          loser: {
            id: userId,
          },
        },
      ],
      order: {
        createdAt: "DESC",
      },
    });
    return matches.map((match) => new GameResultResponse(match));
  }
}
