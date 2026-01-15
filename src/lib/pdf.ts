import jsPDF from "jspdf";
import html2canvas from "html2canvas"; // Keep this import, jsPDF.html might use it internally
import { BonafideRequest, CertificateTemplate, StudentDetails } from "./types";

/**
 * Generates the final HTML content for a certificate by populating a template with data.
 * @param request The bonafide request.
 * @param student The student's profile.
 * @param template The certificate template.
 * @param addSignature A boolean to indicate if the admin signature should be added.
 * @returns The final HTML string for the certificate.
 */
export const getCertificateHtml = (
  request: BonafideRequest,
  student: StudentDetails | null,
  template: CertificateTemplate | undefined,
  addSignature: boolean = false
): string => {
  if (!template) {
    console.error("[getCertificateHtml] Error: Certificate template not found.");
    return "<p>Error: Certificate template not found.</p>";
  }
  if (!student) {
    console.error("[getCertificateHtml] Error: Student details not found.");
    return "<p>Error: Student details not found.</p>";
  }

  console.log("[getCertificateHtml] Raw template content from DB:", template.content);

  const isFemale = student.gender === "Female";
  
  // Pronoun and salutation mappings
  const genderMap = {
    salutation: isFemale ? "Ms." : "Mr.",
    parentRelation: isFemale ? "D/o" : "S/o",
    heShe: isFemale ? "She" : "He",
    hisHer: isFemale ? "her" : "his",
    himHer: isFemale ? "her" : "him"
  };

  let content = template.content || "";

  // Replace standard placeholders
  content = content
    .replace(/{studentName}/g, `${student.first_name} ${student.last_name || ''}`.trim())
    .replace(/{studentId}/g, student.register_number)
    .replace(/{purpose}/g, request.type) // Injected dynamically (e.g., Scholarship, Passport)
    .replace(/{subPurpose}/g, request.sub_type || '') // Optional sub-type
    .replace(/{reason}/g, request.type) // Legacy support for {reason}
    .replace(/{detailedReason}/g, request.reason) // The actual reason text provided by the student
    .replace(/{parentName}/g, student.parent_name || 'N/A')
    .replace(/{department}/g, student.department_name || 'N/A')
    .replace(/{batch}/g, student.batch_name || 'N/A')
    .replace(/{currentSemester}/g, student.current_semester?.toString() || 'N/A')
    .replace(/{date}/g, new Date().toLocaleDateString('en-GB'));

  console.log("[getCertificateHtml] Content after standard replacements:", content);

  // Replace automatic gender markers
  content = content
    .replace(/Mr\/Ms/g, genderMap.salutation)
    .replace(/S\/o or D\/o/g, genderMap.parentRelation)
    .replace(/He\/She/g, genderMap.heShe)
    .replace(/his\/her/g, genderMap.hisHer)
    .replace(/\bHe\b/g, genderMap.heShe)
    .replace(/\bhis\b/g, genderMap.hisHer);

  // Explicit gender placeholders
  content = content
    .replace(/{salutation}/g, genderMap.salutation)
    .replace(/{parentRelation}/g, genderMap.parentRelation)
    .replace(/{heShe}/g, genderMap.heShe)
    .replace(/{hisHer}/g, genderMap.hisHer);

  console.log("[getCertificateHtml] Content after gender-specific replacements:", content);

  if (addSignature) {
    content +=
      "<p style='margin-top: 40px; text-align: right;'>--- E-Signed by Principal ---</p>";
  }

  console.log("[getCertificateHtml] Final HTML content generated:", content); // Debugging line
  return content;
};

/**
 * Generates and downloads a PDF from an HTML string.
 * @param htmlContent The HTML content to convert to PDF.
 * @param fileName The name of the file to be downloaded.
 */
export const generatePdf = async (htmlContent: string, fileName: string) => {
  console.log("[generatePdf] Starting PDF generation for file:", fileName);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Create a temporary div to render the HTML content
  const tempDiv = document.createElement("div");
  tempDiv.style.width = "210mm"; // A4 width
  tempDiv.style.padding = "20mm"; // Padding for margins
  tempDiv.style.boxSizing = "border-box"; // Include padding in width
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px"; // Hide it off-screen
  tempDiv.style.backgroundColor = "white"; // Ensure white background for PDF
  tempDiv.innerHTML = `<div class="prose max-w-none">${htmlContent}</div>`; // Apply prose for styling
  document.body.appendChild(tempDiv);

  // Use jsPDF's html method for better integration
  await pdf.html(tempDiv, {
    callback: function (doc) {
      doc.save(fileName);
      document.body.removeChild(tempDiv); // Clean up the temporary element
      console.log("[generatePdf] PDF generated and downloaded successfully.");
    },
    x: 0,
    y: 0,
    html2canvas: {
      scale: 0.75, // Adjust scale for better fit on A4, might need tweaking
      useCORS: true, // Important if images are from external sources
      logging: true, // Enable logging for html2canvas
      // windowWidth: 210 * 3.779528, // A4 width in pixels at 96dpi (210mm * 3.779528 px/mm)
      // windowHeight: 297 * 3.779528, // A4 height in pixels at 96dpi (297mm * 3.779528 px/mm)
    },
    margin: [10, 10, 10, 10], // Top, Right, Bottom, Left margins in mm
  });
};