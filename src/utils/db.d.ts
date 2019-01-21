import mgo from 'mongoose'

export function initialize (): Promise<void>

export function getUri (): string

export function fetchConnection (dbKey: string): mgo.Connection | mgo.Mongoose

export const mongoose: mgo.Mongoose
