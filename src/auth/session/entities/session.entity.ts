import { Entity , PrimaryGeneratedColumn ,Column ,JoinColumn, ManyToOne } from "typeorm";
import { IsString , Length , IsIP , IsOptional, IsDate, IsBoolean} from "class-validator";
import { User } from "../../user/entities/user.entity.js";
@Entity('session')
export class Session{

@PrimaryGeneratedColumn()
sessionId:number;

@Column()
@IsString()
@Length(30,200)
hash_token :string;

@Column({ type: 'varchar', length: 45 })
@IsIP()
ip_address :string;
 
@Column({ type: 'text', nullable: true })
@IsString()
@IsOptional()
user_agent?: string; 

@Column()
@IsDate()
createdAt : Date;

@Column()
@IsDate()
expiresAt : Date;

@Column()
@IsDate()
modifiedAt : Date;

@ManyToOne(() => User, (user) => user.sessions)
@JoinColumn({ name: 'userId' })
user: User;

@Column()
userId: number;
}