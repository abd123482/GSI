import { Entity , PrimaryGeneratedColumn,Index, Column , ManyToMany, JoinColumn, OneToMany, ManyToOne} from "typeorm";
import { IsString , Length ,IsBoolean ,IsDate,IsEnum, IsInt} from "class-validator";
import { articlestatus } from "../enums/article.enum.js";
import { Stock } from "../../stock/entities/stock.entity.js";
import { SerialNumber } from "../../serialNumber/entities/serialNumber.entity.js";
import { Mouvement } from "../../mouvement/entities/mouvement.entity.js";
@Entity('article')
export class Article {

@Index() 
@PrimaryGeneratedColumn("uuid")
articleId : number;

@Index() 
@Column()
@IsString()
@Length(5,50)
articleName : string;

@Index() 
@Column()
@IsBoolean()
hasSerialNumber:boolean;

@Index() 
@Column({ name: 'status', type: 'nvarchar', length: 100 })
@IsEnum(articlestatus, {
    message :'Invalid article status',
})
articlestatus: articlestatus;

@IsDate()
createdAt:Date;

@IsInt()
quantity_article:number;

@IsDate()
modifiedAt:Date;

@ManyToMany(()=>Stock, (stock)=>stock.articles)
@JoinColumn({name : "stockId"})
stocks :Stock[];

@OneToMany(()=>SerialNumber, (serialNumber)=>serialNumber.article)
serialNumbers:SerialNumber[];

@ManyToMany(()=>Mouvement,(mouvement)=>mouvement.article)
@JoinColumn({name : "mouvementId"})
mouvements:Mouvement[];

}
