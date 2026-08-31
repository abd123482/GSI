import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { IsEmail, IsString, Length, IsInt, IsDate } from "class-validator";
import { Session } from "../../session/entities/session.entity.js"; // ← ADD THIS IMPORT

@Entity('user')
export class User {
    @PrimaryGeneratedColumn()
    userId: number;

    @Column()
    @IsEmail()
    @Length(10, 50)
    email: string;

    @Column()
    @IsString()
    @Length(10, 50)
    username: string;

    @Column()
    @IsString()
    @Length(30, 200)
    hash_password: string;

    @Column()
    @IsInt()
    failed_attempts: number;

    @Column()
    @IsDate()
    locked_until: Date;

    @Column()
    @IsDate()
    updatedAt: Date;

    @Column()
    @IsDate()
    createdAt: Date;

    @OneToMany(() => Session, (session) => session.user)
    sessions: Session[];
}