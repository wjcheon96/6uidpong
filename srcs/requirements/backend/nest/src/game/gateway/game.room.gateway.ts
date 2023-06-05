import { UseGuards } from "@nestjs/common";
import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Namespace, Socket } from "socket.io";
import { WsJwtAccessGuard } from "src/chat/guard/ws-jwt-access.guard";
import { keyCode } from "../dto/game.dto";
import { GameRoomService } from "../service/game.room.service";

@WebSocketGateway(80, {
  namespace: "game",
  cors: {
    origin: [`https://${process.env.HOST_NAME}`],
    credentials: true,
  },
})
@UseGuards(WsJwtAccessGuard)
export class GameRoomGateway {
  @WebSocketServer()
  server: Namespace;

  constructor(private gameRoomService: GameRoomService) {}

  @SubscribeMessage("keyup")
  keyup(client: Socket, payload: keyCode): void {
    this.gameRoomService.handleKeyState(client, payload, 1);
  }

  @SubscribeMessage("keydown")
  keydown(client: Socket, payload: keyCode): void {
    this.gameRoomService.handleKeyState(client, payload, -1);
  }
}
