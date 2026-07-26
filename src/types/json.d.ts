/* The question bank is close to a megabyte; letting TypeScript infer a literal
   type for it makes every check crawl. Imports are cast in src/lib/data.ts. */
declare module '*.json' {
  const value: unknown
  export default value
}
