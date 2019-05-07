import mgo from 'mongoose'

export function initialize (): Promise<void>

export function getUri (): string

export function fetchConnection (): mgo.Mongoose
export function fetchConnection (dbKey: 'default'): mgo.Mongoose
export function fetchConnection (dbKey: string): mgo.Connection

export const mongoose: mgo.Mongoose
export const AutoIncrement: any