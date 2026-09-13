/**
 * Types for the plain-JS deploy script, so the build step can be unit tested from TypeScript.
 */
export declare const MIGRATION_DATABASE_URL_KEYS: string[];

export declare function sslForUrl(url: string, env?: NodeJS.ProcessEnv): false | { rejectUnauthorized: boolean };

export declare function verifyFoundationSchema(url: string): Promise<{ ok: boolean; detail: string }>;
