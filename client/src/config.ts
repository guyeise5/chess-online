import axios from "axios";

const devOrigin = "http://localhost:8080";
export function webSocketOrigin(): string | undefined {
    if(process.env.NODE_ENV == "development") {
        return devOrigin
    }
    return undefined
}
export const heartbeatIntervalMillis = 1000
export function configure() {
    console.log("environment", process.env.NODE_ENV)
    if(process.env.NODE_ENV == "development") {
        axios.defaults.baseURL = devOrigin
    }
}