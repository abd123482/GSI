// mouvement.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  RelationId,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MouvementType } from '../enums/mouvementType.enum.js';
import { Emplacement } from '../../emplacement/entities/emplacement.entity.js';
import { SerialNumber } from '../../serialNumber/entities/serialNumber.entity.js';
import { Article } from '../../article/entities/article.entity.js';

@Entity('mouvement')
export class Mouvement {
  @PrimaryGeneratedColumn()
  mouvementId: number;

  @Column({ type: 'varchar', length: 3, default: MouvementType.OUT })
  mouvementType: MouvementType;

  @Column({ type: 'int' })
  quantityTransfer: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToOne(() => Emplacement, (emplacement) => emplacement.sourceMouvements)
  @JoinColumn({ name: 'sourceEmplacementId' })
  sourceEmplacement: Relation<Emplacement>;

  @RelationId((mouvement: Mouvement) => mouvement.sourceEmplacement)
  sourceEmplacementId: number;

  @ManyToOne(() => Emplacement, (emplacement) => emplacement.destinationMouvements)
  @JoinColumn({ name: 'destinationEmplacementId' })
  destinationEmplacement: Relation<Emplacement>;

  @RelationId((mouvement: Mouvement) => mouvement.destinationEmplacement)
  destinationEmplacementId: number;

  @ManyToMany(() => SerialNumber, (serialNumber) => serialNumber.mouvement)
  serialNumbers: SerialNumber[];

  @ManyToOne(()=>Article,(article)=>article.mouvements)
  article : Article[];
}
