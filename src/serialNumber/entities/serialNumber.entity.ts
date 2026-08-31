import { IsDate, IsEnum, IsString } from "class-validator";
import { Column, Entity ,JoinColumn,ManyToMany,ManyToOne,OneToMany,PrimaryGeneratedColumn} from "typeorm";
import type { Relation } from 'typeorm';
import { serialNumberStatus } from "../enums/serialNumber.enum.js";
import { Emplacement } from "../../emplacement/entities/emplacement.entity.js";
import { Article } from "../../article/entities/article.entity.js";
import { Mouvement } from "../../mouvement/entities/mouvement.entity.js";
@Entity('serialNumber')
export class SerialNumber{

@PrimaryGeneratedColumn()
serialNumberId : number;

@Column()
@IsString()
serialCode : string;

@Column()
@IsDate()
createdAt : Date;

@Column()
@IsDate()
modifiedAt:Date;

@IsEnum(serialNumberStatus,{
    message :'Invalid serial number status'
}
)
serialnumberstatus :serialNumberStatus;

@ManyToMany(()=>Emplacement , (emplacement)=>emplacement.serialNumbers)
@JoinColumn({name :'emplacementId'})
emplacement : Relation<Emplacement>

@ManyToOne(()=>Article , (article)=>article.serialNumbers)
@JoinColumn({name :'articleId'})
article : Relation<Article>;

@Column()
emplacementId : number;

@Column()
articleId:number


@ManyToOne(()=>Mouvement,(mouvement)=>mouvement.serialNumbers)
@JoinColumn({name : "mouvementId"})
mouvement : Relation<Mouvement>

}
