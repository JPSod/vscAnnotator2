import { BaseEntity, Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Scan } from "./Scan";

@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text', { nullable: true })
  name: string;

  @Column("text", { unique: true })
  githubId: string;

  @Column("boolean", { default: false })
  paying: boolean;
  
  @OneToMany(() => Scan, scan => scan.creator)
  scans: Promise<Scan>;
}
