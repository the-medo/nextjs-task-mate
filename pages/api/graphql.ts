import { /*ApolloServer,*/ gql } from 'apollo-server-micro'
import { IResolvers } from '@graphql-tools/utils';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import {NextApiHandler} from "next";
import {ApolloServer } from "apollo-server-micro";
import mysql, {ServerlessMysql} from 'serverless-mysql';

const typeDefs = gql`
  enum TaskStatus {
    active
    completed
  }
  
  type Task {
    id: Int!
    title: String!
    status: TaskStatus!
  }
  
  input CreateTaskInput {
    title: String!
  }
  
  input UpdateTaskInput {
    id: Int!
    title: String
    status: TaskStatus
  }
  
  type Query {
    tasks(status: TaskStatus): [Task!]!
    task(id: Int!): Task
  }
  
  type Mutation {
    createTask(input: CreateTaskInput!): Task
    updateTask(input: UpdateTaskInput!): Task
    deleteTask(id: Int!): Task
  }
`;

interface ApolloContext {
  db: mysql.ServerlessMysql;
}

const resolvers: IResolvers<any, ApolloContext> = {
  Query: {
    async tasks(parent, args, context) {
      const result = await context.db.query(
          'SELECT "HELLO" as hello_world'
      );
      await db.end();
      console.log({result});
      return []
    },
    task(parent, args, context) {
      return null
    },
  },
  Mutation: {
    createTask(parent, args, context) {
      return null
    },
    updateTask(parent, args, context) {
      return null
    },
    deleteTask(parent, args, context) {
      return null
    },
  }
}

const db = mysql({
  config: {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    database: process.env.MYSQL_DATABASE,
    password: process.env.MYSQL_PASSWORD,
  },
});

// const apolloServer = new ApolloServer({ typeDefs, resolvers })

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  context: {db},
  // Display old playground web app when opening http://localhost:3000/api/graphql in the browser
  plugins: [
    ...(process.env.NODE_ENV === 'development'
        ? [ApolloServerPluginLandingPageGraphQLPlayground]
        : []),
  ],
});

// const startServer = apolloServer.start()
const serverStartPromise = apolloServer.start();
let graphqlHandler: NextApiHandler | undefined;

const handler: NextApiHandler = async (req, res) => {
  if (!graphqlHandler) {
    await serverStartPromise;
    graphqlHandler = apolloServer.createHandler({ path: '/api/graphql' });
  }

  return graphqlHandler(req, res);
};

export default handler;

/*
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader(
      'Access-Control-Allow-Origin',
      'https://studio.apollographql.com'
  )
  res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept'
  )
  if (req.method === 'OPTIONS') {
    res.end()
    return false
  }

  await startServer
  await apolloServer.createHandler({
    path: '/api/graphql',
  })(req, res)
}*/

export const config = {
  api: {
    bodyParser: false,
  },
}