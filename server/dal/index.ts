import {MongoDBPuzzleDAL} from "./MongoDBPuzzleDAL";
import {mongodbConnectionString, mongodbDbName, mongodbEnabled} from "../config";
import IPuzzleDAL from "./IPuzzleDAL";
import {InMemoryPuzzleDal} from "./InMemoryPuzzleDal";
let instance: IPuzzleDAL | undefined = undefined
export function puzzleDal(): IPuzzleDAL {
    if(!instance) {
        if(mongodbEnabled && mongodbConnectionString) {
            instance = new MongoDBPuzzleDAL(mongodbConnectionString, mongodbDbName)
        } else {
            instance = new InMemoryPuzzleDal()
        }
    }
    return instance

}