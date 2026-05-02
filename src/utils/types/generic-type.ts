/**
 * Generic type that extends any type with additional properties
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IGenericType<T = any> = T & { [key: string]: any };
