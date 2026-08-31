import { Entity , PrimaryGeneratedColumn,Column , OneToMany} from "typeorm";
import { IsString } from "class-validator";
import { Stock } from "../../stock/entities/stock.entity.js";
@Entity('site')
export class Site{
@PrimaryGeneratedColumn()
siteId :number;

@Column()
@IsString()
siteName:string;

@OneToMany(()=>Stock , (stock)=>stock.site)
stocks : Stock[]

}