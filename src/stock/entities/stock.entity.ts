import { Entity ,PrimaryGeneratedColumn,Column,ManyToOne,JoinColumn, ManyToMany} from "typeorm";
import { IsString } from "class-validator";
import { Site } from "../../site/entities/site.entity.js";
import { Article } from "../../article/entities/article.entity.js";
@Entity('stock')
export class Stock{
    @PrimaryGeneratedColumn()
    stockId : number;

    @Column()
    @IsString()
    stockName : string;

    @ManyToOne(() =>Site,(site)=>site.stocks)
    @JoinColumn({name: 'siteId'})
    site :Site;

    @Column()
    siteId :number;

@ManyToMany(()=>Article, (article)=>article.stocks)
articles:Article[];


}