import {MongoDBPuzzleDAL} from "./MongoDBPuzzleDAL";
import IPuzzleDAL from "./IPuzzleDAL";

let instance: IPuzzleDAL | undefined = undefined

export function puzzleDal(): IPuzzleDAL {
    if (!instance) {
        instance = new MongoDBPuzzleDAL()
    }
    return instance
}