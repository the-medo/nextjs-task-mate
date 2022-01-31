import { /*ApolloServer,*/ gql, UserInputError} from 'apollo-server-micro'
import { ApolloServerPluginLandingPageGraphQLPlayground } from 'apollo-server-core';
import {NextApiHandler} from "next";
import {ApolloServer } from "apollo-server-micro";
import mysql, {ServerlessMysql} from 'serverless-mysql';
import {OkPacket} from "mysql";
import {Resolvers, Task, TaskStatus} from "../../generated/graphql-backend";
import arg from "arg";

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

interface TaskDbRow {
  id: number;
  title: string;
  task_status: TaskStatus;
}

type TasksDbQueryResult = TaskDbRow[];
type TaskDbQueryResult = TaskDbRow[];

const  transformTaskDbRowToTask = (row: TaskDbRow): Task => {
  return {
    id: row.id,
    title: row.title,
    status: row.task_status
  };
}

const getTaskById = async (id: number, db: mysql.ServerlessMysql) => {
  const tasks = await db.query<TaskDbQueryResult>(
      'SELECT * FROM tasks WHERE id = ?',
      [id],
  );
  await db.end();

  return tasks.length ? transformTaskDbRowToTask(tasks[0]) : null;
}

const resolvers: Resolvers<ApolloContext> = {
  Query: {
    async tasks(parent, args, context): Promise<Task[]> {
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
      return tasks.map(({id, title, task_status}) => transformTaskDbRowToTask({id, title, task_status}));
    },
    async task(parent, args, context) {
      return await getTaskById(args.id, context.db);
    },
  },

  Mutation: {
    async createTask(parent, args: {input: {title: string}}, context): Promise<Task> {
      const {input} = args;

      const result = await context.db.query<OkPacket>(
          'INSERT INTO tasks (title, task_status) VALUES(?, ?)',
          [input.title, TaskStatus.Active],
      )
      await db.end();

      return {
        id: result.insertId,
        title: input.title,
        status: TaskStatus.Active,
      }
    },
    async updateTask(parent, args, context) {
      const {id, title, status} = args.input;

      let updateSet: string[] = [];
      let queryParams: (string | number)[] = [];

      if (title) {
        updateSet.push(` title = ? `);
        queryParams.push(title)
      }

      if (status) {
        updateSet.push(` task_status = ? `);
        queryParams.push(status)
      }

      queryParams.push(id);

      const query = `UPDATE tasks SET ${updateSet.join(', ')} WHERE id = ?`;

      const tasks = await context.db.query<TasksDbQueryResult>(
          query,
          queryParams,
      );

      const updatedTask = await getTaskById(id, context.db);
      return updatedTask;
    },
    async deleteTask(parent, args, context) {
      const {id} = args;

      const deletedTask = await getTaskById(id, context.db);

      if (!deletedTask) {
        throw new UserInputError('Could not find your task.');
      }

      await context.db.query<OkPacket>(
          'DELETE FROM tasks WHERE id = ?',
          [id],
      );

      return deletedTask;
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


export const config = {
  api: {
    bodyParser: false,
  },
}