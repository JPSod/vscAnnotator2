import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";

@Entity()
export class Scan extends BaseEntity {
  @PrimaryGeneratedColumn()
    id: number;

  @Column()
    standard: string;

  @Column()
    value: number;

  @CreateDateColumn()
    createdDate: Date;

  @Column()
    file: string;

  @Column()
    creatorId: number;

  @ManyToOne(() => User, (user) => user.scans)
  @JoinColumn({ name: "creatorId" })
    creator: Promise<User>;
  
}
