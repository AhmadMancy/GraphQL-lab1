const express = require("express");
const { ApolloServer, gql } = require("apollo-server-express");

let students = [
  {
    id: "1",
    name: "Salma Youssef",
    email: "salma.y@example.com",
    age: 23,
    major: "Software Engineering",
  },
  {
    id: "2",
    name: "Karim Adel",
    email: "karim.a@example.com",
    age: 22,
    major: "Cybersecurity",
  },
  {
    id: "3",
    name: "Laila Ibrahim",
    email: "laila.i@example.com",
    age: 24,
    major: "Software Engineering",
  },
  {
    id: "4",
    name: "Omar Sherif",
    email: "omar.s@example.com",
    age: 21,
    major: "Artificial Intelligence",
  },
];

let courses = [
  {
    id: "101",
    title: "Web Development Fundamentals",
    code: "WD101",
    credits: 4,
    instructor: "Prof. Nadia",
  },
  {
    id: "102",
    title: "Introduction to AI",
    code: "AI202",
    credits: 3,
    instructor: "Prof. Khaled",
  },
  {
    id: "103",
    title: "Network Security",
    code: "CS405",
    credits: 4,
    instructor: "Prof. Mona",
  },
  {
    id: "104",
    title: "Mobile App Development",
    code: "SE310",
    credits: 3,
    instructor: "Prof. Hany",
  },
];

let enrollments = {
  1: ["101", "104"],
  2: ["103"],
  3: ["101", "102"],
  4: ["102"],
};

const typeDefs = gql`
  type Student {
    id: ID!
    name: String!
    email: String!
    age: Int!
    major: String
    courses: [Course!]!
  }

  type Course {
    id: ID!
    title: String!
    code: String!
    credits: Int!
    instructor: String!
    students: [Student!]!
  }

  type Query {
    getAllStudents: [Student!]!
    getStudent(id: ID!): Student
    getAllCourses: [Course!]!
    getCourse(id: ID!): Course
    searchStudentsByMajor(major: String!): [Student!]!
  }

  type Mutation {
    addStudent(
      name: String!
      email: String!
      age: Int!
      major: String
    ): Student!
    updateStudent(
      id: ID!
      name: String
      email: String
      age: Int
      major: String
    ): Student
    deleteStudent(id: ID!): Boolean!

    addCourse(
      title: String!
      code: String!
      credits: Int!
      instructor: String!
    ): Course!
    updateCourse(
      id: ID!
      title: String
      code: String
      credits: Int
      instructor: String
    ): Course
    deleteCourse(id: ID!): Boolean!

    enrollStudent(studentId: ID!, courseId: ID!): Student
    unenrollStudent(studentId: ID!, courseId: ID!): Student
  }
`;

const resolvers = {
  Query: {
    getAllStudents: () => {
      return students;
    },

    getStudent: (_, { id }) => {
      return students.find((student) => student.id === id);
    },
    getAllCourses: () => {
      return courses;
    },

    getCourse: (_, { id }) => {
      return courses.find((course) => course.id === id);
    },

    searchStudentsByMajor: (_, { major }) => {
      return students.filter(
        (student) =>
          student.major &&
          student.major.toLowerCase().includes(major.toLowerCase())
      );
    },
  },

  Mutation: {
    addStudent: (_, { name, email, age, major }) => {
      const newStudent = {
        id: String(students.length + 1),
        name,
        email,
        age,
        major: major || null,
      };
      students.push(newStudent);
      enrollments[newStudent.id] = [];
      return newStudent;
    },

    updateStudent: (_, { id, name, email, age, major }) => {
      const studentIndex = students.findIndex((student) => student.id === id);
      if (studentIndex === -1) return null;

      const student = students[studentIndex];

      if (name !== undefined) student.name = name;
      if (email !== undefined) student.email = email;
      if (age !== undefined) student.age = age;
      if (major !== undefined) student.major = major;

      students[studentIndex] = student;
      return student;
    },

    deleteStudent: (_, { id }) => {
      const initialLength = students.length;
      students = students.filter((student) => student.id !== id);

      delete enrollments[id];

      return students.length < initialLength;
    },

    addCourse: (_, { title, code, credits, instructor }) => {
      const newCourse = {
        id: String(courses.length + 1),
        title,
        code,
        credits,
        instructor,
      };
      courses.push(newCourse);
      return newCourse;
    },

    updateCourse: (_, { id, title, code, credits, instructor }) => {
      const courseIndex = courses.findIndex((course) => course.id === id);
      if (courseIndex === -1) return null;

      const course = courses[courseIndex];

      if (title !== undefined) course.title = title;
      if (code !== undefined) course.code = code;
      if (credits !== undefined) course.credits = credits;
      if (instructor !== undefined) course.instructor = instructor;

      courses[courseIndex] = course;
      return course;
    },

    deleteCourse: (_, { id }) => {
      const initialLength = courses.length;
      courses = courses.filter((course) => course.id !== id);

      Object.keys(enrollments).forEach((studentId) => {
        enrollments[studentId] = enrollments[studentId].filter(
          (courseId) => courseId !== id
        );
      });

      return courses.length < initialLength;
    },

    enrollStudent: (_, { studentId, courseId }) => {
      const student = students.find((s) => s.id === studentId);
      const course = courses.find((c) => c.id === courseId);

      if (!student || !course) return null;

      if (!enrollments[studentId]) {
        enrollments[studentId] = [];
      }

      if (!enrollments[studentId].includes(courseId)) {
        enrollments[studentId].push(courseId);
      }

      return student;
    },

    unenrollStudent: (_, { studentId, courseId }) => {
      const student = students.find((s) => s.id === studentId);

      if (!student || !enrollments[studentId]) return null;

      enrollments[studentId] = enrollments[studentId].filter(
        (id) => id !== courseId
      );

      return student;
    },
  },

  Student: {
    courses: (parent) => {
      const studentCourseIds = enrollments[parent.id] || [];
      return courses.filter((course) => studentCourseIds.includes(course.id));
    },
  },

  Course: {
    students: (parent) => {
      const enrolledStudentIds = Object.keys(enrollments).filter((studentId) =>
        enrollments[studentId].includes(parent.id)
      );
      return students.filter((student) =>
        enrolledStudentIds.includes(student.id)
      );
    },
  },
};

async function start() {
  const app = express();
  const server = new ApolloServer({
    typeDefs: typeDefs,
    resolvers: resolvers,
  });

  await server.start();
  server.applyMiddleware({ app, path: "/graphql" });
  app.listen(5000, () => {
    console.log(" Server ready at http://localhost:5000/graphql");
    console.log(" Student Management System API");
  });
}
start();
