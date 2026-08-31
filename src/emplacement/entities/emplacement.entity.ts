// emplacement.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Mouvement } from '../../mouvement/entities/mouvement.entity.js';
import { SerialNumber } from '../../serialNumber/entities/serialNumber.entity.js';
import { IsString } from 'class-validator';
@Entity('emplacement')
export class Emplacement {
  @PrimaryGeneratedColumn()
  emplacementId: number;

  @Column()
  @IsString()
  emplacementName: string;

  @OneToMany(() => SerialNumber, (serialNumber) => serialNumber.emplacement)
  serialNumbers: SerialNumber[];

  @OneToMany(() => Mouvement, (mouvement) => mouvement.sourceEmplacement)
  sourceMouvements: Mouvement[];

  @OneToMany(() => Mouvement, (mouvement) => mouvement.destinationEmplacement)
  destinationMouvements: Mouvement[];

}
