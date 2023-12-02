import {mongoClient, mongodbDbName} from "../config";
import {MongoClient} from "mongodb";

export abstract class MongoManager {
    protected client: MongoClient;
    protected dbName: string;
    public constructor() {
        this.client = mongoClient()
        this.dbName = mongodbDbName
    }

}