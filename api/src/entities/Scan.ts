import { BaseEntity, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./User";
import { Standard } from "./Standard";

@Entity()
export class Scan extends BaseEntity {
  @PrimaryGeneratedColumn()
    id: number;

  @Column("float")
    value: number;

  @Column()
    failedFunctions: string;

  @CreateDateColumn()
    createdDate: Date;

  @Column()
    file: string;

  @Column()
    creatorId: number;

  @Column()
    standardId: number;

  @ManyToOne(() => User, (user) => user.scans)
  @JoinColumn({ name: "creatorId" })
    creator: Promise<User>;

  @ManyToOne(() => Standard, (standard) => standard.scans)
  @JoinColumn({ name: "standardId" })
    origin: Promise<Standard>;
    
  standardName: any;
  
}
