import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Scan } from "./Scan";

@Entity()
export class Standard extends BaseEntity {
  @PrimaryGeneratedColumn()
    id: number;

  @Column()
    standard: string;

  @Column()
    content: string;

  @CreateDateColumn()
    createdDate: Date;

  @Column()
    creatorId: number;

  @ManyToOne(() => User, (user) => user.standards)
  @JoinColumn({ name: "creatorId" })
    creator: Promise<User>;

  @OneToMany(() => Scan, scan => scan.origin)
    scans: Promise<Standard>;
  
}
