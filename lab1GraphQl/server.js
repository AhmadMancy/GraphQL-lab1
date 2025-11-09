const expressFramework = require("express");
const {
  ApolloServer: Apollo,
  gql: graphqlQueryLang,
} = require("apollo-server-express");
const graphqlPlayground =
  require("graphql-playground-middleware-express").default;
const jsonwebtoken = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");

const WEB_TOKEN_SECRET = "a-more-secure-secret-key";

let userDatabase = [];
let userNextId = 1;

let learnerDatabase = [
  {
    learnerId: "1",
    fullName: "Ali Mohamed",
    contactEmail: "ali@example.com",
    age: 23,
    fieldOfStudy: "Software Engineering",
  },
  {
    learnerId: "2",
    name: "Sara Ahmed",
    email: "sara@example.com",
    age: 22,
    major: "Data Science",
  },
];
let learnerNextId = 3;

let subjectDatabase = [
  {
    subjectId: "1",
    subjectName: "Introduction to Algorithms",
    subjectIdentifier: "CS101",
    creditHours: 3,
    educator: "Dr. Ahmed",
  },
  {
    subjectId: "2",
    subjectName: "Machine Learning",
    subjectIdentifier: "CS401",
    creditHours: 4,
    educator: "Dr. Fatima",
  },
];
let subjectNextId = 3;

let registrationDatabase = {
  1: ["1", "2"],
  2: ["2"],
};

function isEmailValid(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function ensureAuthenticated(requestContext) {
  if (!requestContext.currentUser) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
}

function isUserEmailAvailable(email, currentUserId = null) {
  return !userDatabase.some(
    (user) =>
      user.id !== currentUserId &&
      user.email.toLowerCase() === email.toLowerCase()
  );
}

function isLearnerEmailAvailable(email, currentLearnerId = null) {
  return !learnerDatabase.some(
    (learner) =>
      learner.id !== currentLearnerId &&
      learner.email.toLowerCase() === email.toLowerCase()
  );
}

function isSubjectCodeAvailable(code, currentSubjectId = null) {
  return !subjectDatabase.some(
    (subject) =>
      subject.id !== currentSubjectId &&
      subject.code.toLowerCase() === code.toLowerCase()
  );
}

function filterItems(data, criteria, itemType) {
  if (!criteria) return data;

  return data.filter((item) => {
    if (itemType === "learner") {
      if (
        criteria.fieldOfStudy &&
        item.fieldOfStudy?.toLowerCase() !== criteria.fieldOfStudy.toLowerCase()
      ) {
        return false;
      }
      if (
        criteria.fullNameContains &&
        !item.fullName
          .toLowerCase()
          .includes(criteria.fullNameContains.toLowerCase())
      ) {
        return false;
      }
      if (
        criteria.emailContains &&
        !item.contactEmail
          .toLowerCase()
          .includes(criteria.emailContains.toLowerCase())
      ) {
        return false;
      }
      if (criteria.minAge !== undefined && item.age < criteria.minAge) {
        return false;
      }
      if (criteria.maxAge !== undefined && item.age > criteria.maxAge) {
        return false;
      }
    } else if (itemType === "subject") {
      if (
        criteria.codeStartsWith &&
        !item.subjectIdentifier
          .toLowerCase()
          .startsWith(criteria.codeStartsWith.toLowerCase())
      ) {
        return false;
      }
      if (
        criteria.subjectNameContains &&
        !item.subjectName
          .toLowerCase()
          .includes(criteria.subjectNameContains.toLowerCase())
      ) {
        return false;
      }
      if (
        criteria.educator &&
        item.educator.toLowerCase() !== criteria.educator.toLowerCase()
      ) {
        return false;
      }
      if (
        criteria.minCredits !== undefined &&
        item.creditHours < criteria.minCredits
      ) {
        return false;
      }
      if (
        criteria.maxCredits !== undefined &&
        item.creditHours > criteria.maxCredits
      ) {
        return false;
      }
    }
    return true;
  });
}

function sortItems(data, sortKey, direction) {
  if (!sortKey) return data;

  const sortDirection = direction?.toUpperCase() === "DESC" ? -1 : 1;

  return [...data].sort((itemA, itemB) => {
    const valueA = itemA[sortKey];
    const valueB = itemB[sortKey];

    if (valueA === undefined || valueB === undefined) return 0;

    if (typeof valueA === "string") {
      return sortDirection * valueA.localeCompare(valueB);
    }

    return sortDirection * (valueA - valueB);
  });
}

function paginateItems(data, paginationOptions) {
  const pageSize = Math.min(paginationOptions?.pageSize || 10, 50);
  const pageNumber = paginationOptions?.pageNumber || 0;
  const startIndex = pageNumber * pageSize;

  return data.slice(startIndex, startIndex + pageSize);
}

const schemaDefinition = graphqlQueryLang`
  type SystemUser {
    userId: ID!
    userEmail: String!
  }

  type AuthenticationResponse {
    authToken: String!
    systemUser: SystemUser!
  }

  type Learner {
    learnerId: ID!
    fullName: String!
    contactEmail: String!
    age: Int!
    fieldOfStudy: String
    enrolledSubjects: [Subject!]!
    subjectCount: Int!
  }

  type Subject {
    subjectId: ID!
    subjectName: String!
    subjectIdentifier: String!
    creditHours: Int!
    educator: String!
    registeredLearners: [Learner!]!
    learnerCount: Int!
  }

  input LearnerModificationInput {
    fullName: String
    contactEmail: String
    age: Int
    fieldOfStudy: String
  }

  input SubjectModificationInput {
    subjectName: String
    subjectIdentifier: String
    creditHours: Int
    educator: String
  }

  input QueryOptions {
    pageSize: Int
    pageNumber: Int
    sortKey: String
    sortDirection: String
  }

  input LearnerFilterCriteria {
    fieldOfStudy: String
    fullNameContains: String
    emailContains: String
    minAge: Int
    maxAge: Int
  }

  input SubjectFilterCriteria {
    codeStartsWith: String
    subjectNameContains: String
    educator: String
    minCredits: Int
    maxCredits: Int
  }

  type Query {
    fetchAllLearners(criteria: LearnerFilterCriteria, options: QueryOptions): [Learner!]!
    fetchLearnerById(learnerId: ID!): Learner
    fetchAllSubjects(criteria: SubjectFilterCriteria, options: QueryOptions): [Subject!]!
    fetchSubjectById(subjectId: ID!): Subject
    findLearnersByField(field: String!): [Learner!]!
  }

  type Mutation {
    registerUser(email: String!, pass: String!): AuthenticationResponse!
    authenticateUser(email: String!, pass: String!): AuthenticationResponse!

    registerLearner(
      fullName: String!
      contactEmail: String!
      age: Int!
      fieldOfStudy: String
    ): Learner!
    modifyLearner(learnerId: ID!, modifications: LearnerModificationInput!): Learner!
    removeLearner(learnerId: ID!): Boolean!

    createSubject(
      subjectName: String!
      subjectIdentifier: String!
      creditHours: Int!
      educator: String!
    ): Subject!
    modifySubject(subjectId: ID!, modifications: SubjectModificationInput!): Subject!
    removeSubject(subjectId: ID!): Boolean!

    registerLearnerForSubject(learnerId: ID!, subjectId: ID!): Learner!
    unregisterLearnerFromSubject(learnerId: ID!, subjectId: ID!): Learner!
  }
`;

const resolverFunctions = {
  Query: {
    fetchAllLearners: (_, { criteria, options }) => {
      let learners = learnerDatabase;

      learners = filterItems(learners, criteria, "learner");
      learners = sortItems(learners, options?.sortKey, options?.sortDirection);
      learners = paginateItems(learners, options);

      return learners;
    },

    fetchLearnerById: (_, { learnerId }) => {
      return learnerDatabase.find((learner) => learner.learnerId === learnerId);
    },

    fetchAllSubjects: (_, { criteria, options }) => {
      let subjects = subjectDatabase;

      subjects = filterItems(subjects, criteria, "subject");
      subjects = sortItems(subjects, options?.sortKey, options?.sortDirection);
      subjects = paginateItems(subjects, options);

      return subjects;
    },

    fetchSubjectById: (_, { subjectId }) => {
      return subjectDatabase.find((subject) => subject.subjectId === subjectId);
    },

    findLearnersByField: (_, { field }) => {
      return learnerDatabase.filter(
        (learner) =>
          learner.fieldOfStudy &&
          learner.fieldOfStudy.toLowerCase().includes(field.toLowerCase())
      );
    },
  },

  Mutation: {
    registerUser: async (_, { email, pass }) => {
      if (!isEmailValid(email)) {
        throw new Error("Invalid email address.");
      }
      if (pass.length < 8) {
        throw new Error("Password must be at least 8 characters long.");
      }
      if (!isUserEmailAvailable(email)) {
        throw new Error("An account with this email already exists.");
      }

      const hashedPassword = await bcryptjs.hash(pass, 12);
      const newSystemUser = {
        userId: String(userNextId++),
        userEmail: email.toLowerCase(),
        passwordHash: hashedPassword,
      };
      userDatabase.push(newSystemUser);

      const authToken = jsonwebtoken.sign(
        { userId: newSystemUser.userId, userEmail: newSystemUser.userEmail },
        WEB_TOKEN_SECRET,
        { expiresIn: "1d" }
      );

      return {
        authToken,
        systemUser: {
          userId: newSystemUser.userId,
          userEmail: newSystemUser.userEmail,
        },
      };
    },

    authenticateUser: async (_, { email, pass }) => {
      const systemUser = userDatabase.find(
        (user) => user.userEmail.toLowerCase() === email.toLowerCase()
      );
      if (!systemUser) {
        throw new Error("Authentication failed.");
      }

      const isPasswordCorrect = await bcryptjs.compare(
        pass,
        systemUser.passwordHash
      );
      if (!isPasswordCorrect) {
        throw new Error("Authentication failed.");
      }

      const authToken = jsonwebtoken.sign(
        { userId: systemUser.userId, userEmail: systemUser.userEmail },
        WEB_TOKEN_SECRET,
        { expiresIn: "1d" }
      );

      return {
        authToken,
        systemUser: {
          userId: systemUser.userId,
          userEmail: systemUser.userEmail,
        },
      };
    },

    registerLearner: (
      _,
      { fullName, contactEmail, age, fieldOfStudy },
      requestContext
    ) => {
      ensureAuthenticated(requestContext);

      if (!isEmailValid(contactEmail)) {
        throw new Error("Invalid email address.");
      }
      if (!isLearnerEmailAvailable(contactEmail)) {
        throw new Error("A learner with this email already exists.");
      }
      if (age < 18) {
        throw new Error("Learner must be at least 18 years old.");
      }

      const newLearner = {
        learnerId: String(learnerNextId++),
        fullName,
        contactEmail,
        age,
        fieldOfStudy: fieldOfStudy || "Undeclared",
      };
      learnerDatabase.push(newLearner);
      registrationDatabase[newLearner.learnerId] = [];
      return newLearner;
    },

    modifyLearner: (_, { learnerId, modifications }, requestContext) => {
      ensureAuthenticated(requestContext);

      const learner = learnerDatabase.find((l) => l.learnerId === learnerId);
      if (!learner) {
        throw new Error("Learner not found.");
      }

      if (modifications.contactEmail !== undefined) {
        if (!isEmailValid(modifications.contactEmail)) {
          throw new Error("Invalid email address.");
        }
        if (!isLearnerEmailAvailable(modifications.contactEmail, learnerId)) {
          throw new Error("A learner with this email already exists.");
        }
        learner.contactEmail = modifications.contactEmail;
      }

      if (modifications.age !== undefined) {
        if (modifications.age < 18) {
          throw new Error("Learner must be at least 18 years old.");
        }
        learner.age = modifications.age;
      }

      if (modifications.fullName !== undefined)
        learner.fullName = modifications.fullName;
      if (modifications.fieldOfStudy !== undefined)
        learner.fieldOfStudy = modifications.fieldOfStudy;

      return learner;
    },

    removeLearner: (_, { learnerId }, requestContext) => {
      ensureAuthenticated(requestContext);

      const initialCount = learnerDatabase.length;
      learnerDatabase = learnerDatabase.filter(
        (learner) => learner.learnerId !== learnerId
      );
      delete registrationDatabase[learnerId];

      return learnerDatabase.length < initialCount;
    },

    createSubject: (
      _,
      { subjectName, subjectIdentifier, creditHours, educator },
      requestContext
    ) => {
      ensureAuthenticated(requestContext);

      if (!isSubjectCodeAvailable(subjectIdentifier)) {
        throw new Error("A subject with this code already exists.");
      }
      if (creditHours < 1 || creditHours > 5) {
        throw new Error("Credit hours must be between 1 and 5.");
      }

      const newSubject = {
        subjectId: String(subjectNextId++),
        subjectName,
        subjectIdentifier,
        creditHours,
        educator,
      };
      subjectDatabase.push(newSubject);
      return newSubject;
    },

    modifySubject: (_, { subjectId, modifications }, requestContext) => {
      ensureAuthenticated(requestContext);

      const subject = subjectDatabase.find((s) => s.subjectId === subjectId);
      if (!subject) {
        throw new Error("Subject not found.");
      }

      if (modifications.subjectIdentifier !== undefined) {
        if (
          !isSubjectCodeAvailable(modifications.subjectIdentifier, subjectId)
        ) {
          throw new Error("A subject with this code already exists.");
        }
        subject.subjectIdentifier = modifications.subjectIdentifier;
      }

      if (modifications.creditHours !== undefined) {
        if (modifications.creditHours < 1 || modifications.creditHours > 5) {
          throw new Error("Credit hours must be between 1 and 5.");
        }
        subject.creditHours = modifications.creditHours;
      }

      if (modifications.subjectName !== undefined)
        subject.subjectName = modifications.subjectName;
      if (modifications.educator !== undefined)
        subject.educator = modifications.educator;

      return subject;
    },

    removeSubject: (_, { subjectId }, requestContext) => {
      ensureAuthenticated(requestContext);

      const initialCount = subjectDatabase.length;
      subjectDatabase = subjectDatabase.filter(
        (subject) => subject.subjectId !== subjectId
      );

      Object.keys(registrationDatabase).forEach((learnerId) => {
        registrationDatabase[learnerId] = registrationDatabase[
          learnerId
        ].filter((regSubjectId) => regSubjectId !== subjectId);
      });

      return subjectDatabase.length < initialCount;
    },

    registerLearnerForSubject: (
      _,
      { learnerId, subjectId },
      requestContext
    ) => {
      ensureAuthenticated(requestContext);

      const learner = learnerDatabase.find((l) => l.learnerId === learnerId);
      const subject = subjectDatabase.find((s) => s.subjectId === subjectId);

      if (!learner) {
        throw new Error("Learner not found.");
      }
      if (!subject) {
        throw new Error("Subject not found.");
      }

      if (!registrationDatabase[learnerId]) {
        registrationDatabase[learnerId] = [];
      }

      if (!registrationDatabase[learnerId].includes(subjectId)) {
        registrationDatabase[learnerId].push(subjectId);
      }

      return learner;
    },

    unregisterLearnerFromSubject: (
      _,
      { learnerId, subjectId },
      requestContext
    ) => {
      ensureAuthenticated(requestContext);

      const learner = learnerDatabase.find((l) => l.learnerId === learnerId);
      if (!learner) {
        throw new Error("Learner not found.");
      }

      if (registrationDatabase[learnerId]) {
        registrationDatabase[learnerId] = registrationDatabase[
          learnerId
        ].filter((regSubjectId) => regSubjectId !== subjectId);
      }

      return learner;
    },
  },

  Learner: {
    enrolledSubjects: (learner) => {
      const learnerSubjectIds = registrationDatabase[learner.learnerId] || [];
      return subjectDatabase.filter((subject) =>
        learnerSubjectIds.includes(subject.subjectId)
      );
    },

    subjectCount: (learner) => {
      const learnerSubjectIds = registrationDatabase[learner.learnerId] || [];
      return learnerSubjectIds.length;
    },
  },

  Subject: {
    registeredLearners: (subject) => {
      const registeredLearnerIds = Object.keys(registrationDatabase).filter(
        (learnerId) =>
          registrationDatabase[learnerId].includes(subject.subjectId)
      );
      return learnerDatabase.filter((learner) =>
        registeredLearnerIds.includes(learner.learnerId)
      );
    },

    learnerCount: (subject) => {
      const registeredLearnerIds = Object.keys(registrationDatabase).filter(
        (learnerId) =>
          registrationDatabase[learnerId].includes(subject.subjectId)
      );
      return registeredLearnerIds.length;
    },
  },
};

async function initializeServer() {
  const webApp = expressFramework();
  const apolloInstance = new Apollo({
    typeDefs: schemaDefinition,
    resolvers: resolverFunctions,
    context: ({ req }) => {
      const authorizationHeader = req.headers.authorization || "";

      if (authorizationHeader.startsWith("Bearer ")) {
        const token = authorizationHeader.substring(7);

        try {
          const decodedToken = jsonwebtoken.verify(token, WEB_TOKEN_SECRET);
          const systemUser = userDatabase.find(
            (user) => user.userId === decodedToken.userId
          );

          return {
            currentUser: systemUser
              ? { userId: systemUser.userId, userEmail: systemUser.userEmail }
              : null,
          };
        } catch (error) {
          return { currentUser: null };
        }
      }

      return { currentUser: null };
    },
  });

  await apolloInstance.start();
  apolloInstance.applyMiddleware({ app: webApp, path: "/api" });

  webApp.get("/explorer", graphqlPlayground({ endpoint: "/api" }));

  webApp.listen(5000, () => {
    console.log("GraphQL server is running at http://localhost:5000/api");
    console.log(
      "GraphQL Playground is available at http://localhost:5000/explorer"
    );
  });
}

initializeServer();
