import * as xlsx from "xlsx";
import { StudentDetails } from "./types";

const studentTemplateHeaders = [
  "first_name",
  "last_name",
  "username",
  "email",
  "phone_number",
  "register_number",
  "parent_name",
  "department_name",
  "tutor_name (Optional)",
  "hod_name (Optional)",
  "batch_name (e.g., 2024-2028 A)", // Keep the example in the header for user clarity
  "password",
];

// Internal mapping keys used for JSON conversion
const internalKeys = [
  "first_name",
  "last_name",
  "username",
  "email",
  "phone_number",
  "register_number",
  "parent_name",
  "department_name",
  "tutor_name",
  "hod_name",
  "batch_name",
  "password",
];

/**
 * Generates and downloads an XLSX template for student bulk upload.
 */
export const downloadStudentTemplate = () => {
  const worksheet = xlsx.utils.aoa_to_sheet([studentTemplateHeaders]);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Students");
  xlsx.writeFile(workbook, "student_upload_template.xlsx");
};

/**
 * Parses an uploaded XLSX file and returns an array of student profiles.
 * @param file The uploaded file object.
 * @returns A promise that resolves to an array of objects with student details, including department_name, batch_name, tutor_name, hod_name, and password.
 */
export const parseStudentFile = (file: File): Promise<Partial<StudentDetails & { password?: string; department_name?: string; batch_name?: string; tutor_name?: string; hod_name?: string }>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        // xlsx.read supports CSV automatically if type is 'binary' or 'string', or 'array' with simple content.
        // For 'array', it usually detects format.
        const workbook = xlsx.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Use raw: true to get the underlying cell value (number or string)
        // Then manually convert the register_number to a string to prevent scientific notation.
        const json = xlsx.utils.sheet_to_json<Partial<StudentDetails & { password?: string; department_name?: string; batch_name?: string; tutor_name?: string; hod_name?: string }>>(worksheet, {
          header: internalKeys,
          range: 1, // Start reading data from the second row (index 1), skipping the header row
          raw: true, // Read raw values (numbers as numbers, strings as strings)
        });

        // Clean up data (trim strings and ensure register_number is a string)
        const cleanedJson = json.map(row => {
          const cleanedRow: any = {};
          for (const key in row) {
            const value = (row as any)[key];

            if (key === 'register_number' && value !== undefined && value !== null) {
              // Convert large numbers to string without scientific notation, handles CSV numbers too
              cleanedRow[key] = String(value).trim();
            } else {
              cleanedRow[key] = typeof value === 'string' ? value.trim() : value;
            }
          }
          return cleanedRow;
        });

        resolve(cleanedJson);
      } catch (error) {
        console.error("Error parsing file:", error);
        reject(new Error("Failed to parse file. Ensure it is a valid Excel or CSV file."));
      }
    };
    reader.onerror = (error) => {
      reject(error);
    };
    reader.readAsArrayBuffer(file);
  });
};