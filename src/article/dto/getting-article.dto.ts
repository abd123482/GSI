import { Optional } from "@nestjs/common"
import { IsBoolean, IsString , IsEnum , IsDate, IsInt } from "class-validator"
import { articlestatus } from "../enums/article.enum.js";
export class GettingArticleDTO{
    @IsString()
    @Optional()
    name?:string

    @IsBoolean()
    @Optional()
    hasSerialNumber?:boolean;

    @IsEnum(articlestatus, {
        message :'Invalid article status',
    })
    @Optional()
    articlestatus?: articlestatus;

    
    @IsDate()
    @Optional()
    createdAt?:Date;

    @IsInt()
    @Optional()
    quantity_article?:number;
    
    @IsDate()   
    @Optional()
    modifiedAt?:Date;

}