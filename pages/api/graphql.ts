import { /*ApolloServer,*/ gql } from 'apollo-server-micro'
import { IResolvers } from '@graphql-tools/utils';
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import {NextApiHandler} from "next";
import {ApolloServer } from "apollo-server-micro";
import mysql, {ServerlessMysql} from 'serverless-mysql';
import {OkPacket} from "mysql";

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

enum TaskStatus {
  active = 'active',
  completed = 'completed',
}

interface Task {
  id: number;
  title: string;
  status: TaskStatus;
}

interface TaskDbRow {
  id: number;
  title: string;
  task_status: TaskStatus;
}

type TasksDbQueryResult = TaskDbRow[];

const resolvers: IResolvers<any, ApolloContext> = {
  Query: {
    async tasks(parent, args: {status?: TaskStatus}, context): Promise<Task[]> {
      const {status} = args;
      let query = 'SELECT id, title, task_status FROM tasks';
      const queryParams: string[] = [];

      if (status) {
        query += ' WHERE task_status = ?';
        queryParams.push(status);
      }

      const tasks = await context.db.query<TasksDbQueryResult>(
          query,
          queryParams,
      );
      await db.end();
      return tasks.map(({id, title, task_status}) => ({
        id,
        title,
        status: task_status
      }));
    },
    task(parent, args, context) {
      return null
    },
  },

  Mutation: {
    async createTask(parent, args: {input: {title: string}}, context): Promise<Task> {
      const {input} = args;

      const result = await context.db.query<OkPacket>(
          'INSERT INTO tasks (title, task_status) VALUES(?, ?)',
          [input.title, TaskStatus.active],
      )
      await db.end();

      return {
        id: result.insertId,
        title: input.title,
        status: TaskStatus.active,
      }
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