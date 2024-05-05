import { serial, text, timestamp, integer, pgTable, uuid, boolean, pgEnum} from "drizzle-orm/pg-core";
import { createId } from '@paralleldrive/cuid2';
import { relations } from "drizzle-orm";

// rp = password reset, ec = email confirmation
export const userTokensOps = pgEnum("op", ["rp", "ec"])

export const user = pgTable("user", {
    uid: uuid('uuid').defaultRandom().primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    password: text("password").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    active: boolean("active").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
});

export const userTokens = pgTable("user_tokens", {
    id: serial("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: uuid("user_id").notNull().references(() => user.uid),
    expiresAt: timestamp("expires_at").notNull().$defaultFn(() => new Date(Date.now() + 24 * 60 * 60 * 1000)),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    active: boolean("active").notNull().default(true),
    op: userTokensOps('op').notNull(),
});

export const post = pgTable("post", {
    uid: uuid('uuid').defaultRandom().primaryKey(),
	caption: text("content").notNull(),
    author: uuid("author").notNull().references(() => user.uid),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const comments = pgTable("comments", {
    id: text('id')
        .$defaultFn(() => createId())
        .primaryKey(),
    comment: text("comment").notNull(),
    postId: uuid("post_id")
        .notNull()
        .references(() => post.uid),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const usersRelations = relations(post, ({ many }) => ({
	posts: many(post),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
	post: one(post, { fields: [comments.postId], references: [post.uid] }),
	user: one(user, { fields: [comments.id], references: [user.uid] }),
}));

export const postRelations = relations(post, ({ one, many }) => ({
    user: one(user, { fields: [post.author], references: [user.uid] }),
    comments: many(comments),
}));