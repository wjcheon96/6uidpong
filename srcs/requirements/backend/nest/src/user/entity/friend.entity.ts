import { UserEntity } from "src/user/entity/user.entity";
import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";

@Entity("friends")
export class FriendEntity {
  @PrimaryColumn({ name: "from_id" })
  fromId: number;

  @PrimaryColumn({ name: "to_id" })
  toId: number;

  @ManyToOne(() => UserEntity, {
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "from_id" })
  from: UserEntity;

  @ManyToOne(() => UserEntity, {
    onUpdate: "CASCADE",
  })
  @JoinColumn({ name: "to_id" })
  to: UserEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
