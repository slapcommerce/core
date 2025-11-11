import { Database } from "bun:sqlite"
import { schemas } from "../infrastructure/schemas"

export class Slap {
    static init () {
        const db = new Database('slap.db')
        for (const schema of schemas) {
            db.run(schema)
        }
        Bun.serve({
            routes: {
                
            }
        })
    }
}