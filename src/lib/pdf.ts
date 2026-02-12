import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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

  // Content is now expected to be raw HTML, no unescaping needed here.
  let content = template.content || "";
  console.log("[getCertificateHtml] Content after initial processing (no unescaping):", content);

  // Ensure gender defaults to 'Male' if not explicitly set
  const isFemale = student.gender === "Female";

  // Pronoun and salutation mappings
  const genderMap = {
    salutation: isFemale ? "Ms." : "Mr.",
    parentRelation: isFemale ? "D/o" : "S/o",
    heShe: isFemale ? "She" : "He",
    hisHer: isFemale ? "her" : "his",
    himHer: isFemale ? "her" : "him"
  };

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
  console.log("[generatePdf] HTML content length:", htmlContent.length);

  if (!htmlContent || htmlContent.trim() === "") {
    console.error("[generatePdf] HTML content is empty, cannot generate PDF.");
    throw new Error("HTML content is empty, cannot generate PDF.");
  }

  const tempDiv = document.createElement("div");
  tempDiv.style.width = "210mm"; // A4 width
  tempDiv.style.padding = "20mm"; // Padding for margins
  tempDiv.style.boxSizing = "border-box"; // Include padding in width
  tempDiv.style.position = "absolute"; // Position absolutely
  // Use visibility hidden instead of far-left positioning to ensure rendering context is active but not visible
  tempDiv.style.zIndex = "-1000";
  tempDiv.style.visibility = "hidden";
  tempDiv.style.top = "0";
  tempDiv.style.left = "0";
  tempDiv.style.backgroundColor = "white"; // Ensure white background for PDF
  tempDiv.innerHTML = `<div class="prose max-w-none">${htmlContent}</div>`; // Apply prose for styling
  document.body.appendChild(tempDiv);

  try {
    // Wait for fonts to load
    await document.fonts.ready;

    // Slight delay to ensure DOM updates and image loading (if any)
    await new Promise(r => setTimeout(r, 500));

    // Temporarily make visible for capture (browsers sometimes optimize away hidden elements)
    // But since we use z-index -1000, it should be behind everything. 
    // Ideally, for html2canvas, it needs to be "visible" in the DOM tree.
    tempDiv.style.visibility = "visible";

    const canvas = await html2canvas(tempDiv, {
      scale: 2, // Increase scale for better resolution in PDF
      useCORS: true,
      logging: false, // Disable logging in production
      windowWidth: tempDiv.offsetWidth, // Pass explicit width
      windowHeight: tempDiv.offsetHeight, // Pass explicit height
      allowTaint: true, // Allow cross-origin images if CORS is not perfectly set (use with caution)
      backgroundColor: "#ffffff", // Force white background
    });

    // Hide it again immediately
    tempDiv.style.visibility = "hidden";

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(fileName);
    console.log("[generatePdf] PDF generated and downloaded successfully.");

  } catch (error) {
    console.error("[generatePdf] Error during html2canvas or PDF generation:", error);
    throw new Error("Failed to generate PDF: " + (error as Error).message);
  } finally {
    if (document.body.contains(tempDiv)) {
      document.body.removeChild(tempDiv); // Clean up the temporary element
    }
  }
};