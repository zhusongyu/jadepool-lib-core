import redis from 'redis'

export function initialize (): Promise<void>

export function getOpts (name?: string): { url: string, [key: string]: string }

export function fetchClient (name: string): redis.RedisClient
