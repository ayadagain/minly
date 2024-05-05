require('dotenv').config()
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";
import path from "path";

const dirname = path.resolve(path.dirname(''));

const sql = neon(process.env.DATABASE_URL ? process.env.DATABASE_URL : "");

const db = drizzle(sql);

const main = async() => {
    try {
        await migrate(db, {
            migrationsFolder: dirname + "/dist/db/migrations",
        });
        console.log("Migrations ran successfully");
    } catch (error) {
        console.error("Error running migrations", error);
        process.exit(1);
    }
}

main()