"use strict";

const loginPanel = document.querySelector("#loginPanel");
const dashboardPanel = document.querySelector("#dashboardPanel");
const loginForm = document.querySelector("#loginForm");
const loginButton = document.querySelector("#loginButton");
const logoutButton = document.querySelector("#logoutButton");
const filterForm = document.querySelector("#filterForm");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const applicationRows = document.querySelector("#applicationRows");
const resultCount = document.querySelector("#resultCount");
const emptyState = document.querySelector("#emptyState");
const pageSummary = document.querySelector("#pageSummary");
const previousPage = document.querySelector("#previousPage");
const nextPage = document.querySelector("#nextPage");
const detailPanel = document.querySelector("#detailPanel");
const detailGrid = document.querySelector("#detailGrid");
const detailStatus = document.querySelector("#detailStatus");
const saveStatus = document.querySelector("#saveStatus");
const rejectionReasonField = document.querySelector("#rejectionReasonField");
const rejectionReason = document.querySelector("#rejectionReason");
const studentEmailAction = document.querySelector("#studentEmailAction");
const parentWhatsappAction = document.querySelector("#parentWhatsappAction");
const applicationContactActions = document.querySelector("#applicationContactActions");
const toast = document.querySelector("#adminToast");

const pageSize = 25;
const statusLabels = {
  received: "Received",
  reviewing: "Reviewing",
  admitted: "Admitted",
  rejected: "Rejected",
};
const details = [
  ["Student name", "studentName"],
  ["Email", "studentEmail"],
  ["Age", "age"],
  ["Sex", "sex"],
  ["Joining class", "joiningClass"],
  ["Date of birth", "dateOfBirth"],
  ["Nationality", "nationality"],
  ["District", "district"],
  ["Subcounty", "subcounty"],
  ["County", "county"],
  ["Parish", "parish"],
  ["Village", "village"],
  ["Previous school", "previousSchoolName"],
  ["Learner Identification Number (LIN)", "previousSchoolLin"],
  ["Mother alive", "motherAlive", (value) => value ? "Yes" : "No"],
  ["Mother's name", "motherName"],
  ["Mother's NIN", "motherNin"],
  ["Mother's contact", "motherContact"],
  ["Father alive", "fatherAlive", (value) => value ? "Yes" : "No"],
  ["Father's name", "fatherName"],
  ["Father's NIN", "fatherNin"],
  ["Father's contact", "fatherContact"],
  ["Parent / guardian contact", "parentContact"],
  ["Parent / guardian WhatsApp", "parentWhatsapp"],
  ["Support or accommodation details", "supportNeeds"],
  ["How they heard about us", "referralSource"],
  ["Referral details", "referralDetails"],
  ["Rejection reason", "rejectionReason"],
  ["Submitted", "createdAt", formatDate],
];

let currentPage = 1;
let totalResults = 0;
let selectedAdmissionNumber = "";
let toastTimer;

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) {
    return null;
  }
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || "The request could not be completed.");
  }
  return body;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3600);
}

function setAuthenticated(admin) {
  loginPanel.hidden = Boolean(admin);
  dashboardPanel.hidden = !admin;
  if (admin) {
    document.querySelector("#welcomeText").textContent = `Signed in as ${admin.username}.`;
  } else {
    loginForm.reset();
  }
}

function formatDate(value) {
  if (!value) {
    return "Not provided";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function updateRejectionReasonField() {
  const isRejected = detailStatus.value === "rejected";
  rejectionReasonField.hidden = !isRejected;
  rejectionReason.disabled = !isRejected;
  rejectionReason.required = isRejected;
}

function createStatusPill(status) {
  const pill = document.createElement("span");
  pill.className = `status-pill ${status}`;
  pill.textContent = statusLabels[status] || status;
  return pill;
}

function createApplicationRow(application) {
  const row = document.createElement("tr");
  const numberCell = document.createElement("td");
  const numberButton = document.createElement("button");
  numberButton.type = "button";
  numberButton.className = "admission-link";
  numberButton.textContent = application.admissionNumber;
  numberButton.addEventListener("click", () => loadApplication(application.admissionNumber));
  numberCell.append(numberButton);
  row.append(numberCell);

  const nameCell = document.createElement("td");
  nameCell.className = "student-name";
  nameCell.textContent = application.studentName;
  row.append(nameCell);

  const districtCell = document.createElement("td");
  districtCell.textContent = application.district || "—";
  row.append(districtCell);

  const dateCell = document.createElement("td");
  dateCell.textContent = formatDate(application.createdAt);
  row.append(dateCell);

  const statusCell = document.createElement("td");
  statusCell.append(createStatusPill(application.status));
  row.append(statusCell);

  const actionCell = document.createElement("td");
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "open-button";
  openButton.setAttribute("aria-label", `View ${application.studentName}'s application`);
  openButton.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>';
  openButton.addEventListener("click", () => loadApplication(application.admissionNumber));
  actionCell.append(openButton);
  row.append(actionCell);
  return row;
}

async function loadApplications() {
  resultCount.textContent = "Loading applications…";
  const parameters = new URLSearchParams({
    page: String(currentPage),
    search: searchInput.value.trim(),
    status: statusFilter.value,
  });

  try {
    const result = await apiRequest(`/api/admin/applications?${parameters}`);
    totalResults = result.total;
    applicationRows.replaceChildren(...result.applications.map(createApplicationRow));
    emptyState.hidden = result.applications.length > 0;
    resultCount.textContent = `${totalResults} application${totalResults === 1 ? "" : "s"} found`;
    const first = totalResults ? (currentPage - 1) * pageSize + 1 : 0;
    const last = Math.min(currentPage * pageSize, totalResults);
    pageSummary.textContent = totalResults ? `Showing ${first}–${last} of ${totalResults}` : "No results";
    previousPage.disabled = currentPage <= 1;
    nextPage.disabled = currentPage * pageSize >= totalResults;
  } catch (error) {
    if (error.message.includes("sign in")) {
      setAuthenticated(null);
      showToast("Your admin session has ended. Please sign in again.");
      return;
    }
    resultCount.textContent = "Could not load applications.";
    showToast(error.message);
  }
}

function addDetail(label, value) {
  const item = document.createElement("div");
  item.className = "detail-field";
  const term = document.createElement("span");
  term.textContent = label;
  const detail = document.createElement("strong");
  detail.textContent = value === "" || value === null || value === undefined
    ? "Not provided"
    : String(value);
  item.append(term, detail);
  detailGrid.append(item);
}

async function loadApplication(admissionNumber) {
  try {
    const result = await apiRequest(
      `/api/admin/applications/${encodeURIComponent(admissionNumber)}`,
    );
    const application = result.application;
    selectedAdmissionNumber = application.admissionNumber;
    document.querySelector("#detailHeading").textContent = application.studentName;
    document.querySelector("#detailAdmission").textContent = application.admissionNumber;
    detailGrid.replaceChildren();
    for (const [label, field, format] of details) {
      addDetail(label, format ? format(application[field]) : application[field]);
    }
    detailStatus.value = application.status;
    rejectionReason.value = application.rejectionReason || "";
    updateRejectionReasonField();

    studentEmailAction.hidden = !application.studentEmail;
    studentEmailAction.href = application.studentEmail
      ? `mailto:${encodeURIComponent(application.studentEmail)}?subject=${encodeURIComponent(`Heart & Hands admission ${application.admissionNumber}`)}`
      : "";

    const rawWhatsapp = application.parentWhatsapp || application.parentContact || "";
    let whatsappNumber = rawWhatsapp.replace(/\D/g, "");
    if (whatsappNumber.startsWith("0")) {
      whatsappNumber = `256${whatsappNumber.slice(1)}`;
    }
    parentWhatsappAction.hidden = !whatsappNumber;
    parentWhatsappAction.href = whatsappNumber
      ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hello, this is Heart & Hands admissions. We are contacting you about ${application.studentName}'s application ${application.admissionNumber}.`)}`
      : "";
    applicationContactActions.hidden = !application.studentEmail && !whatsappNumber;
    detailPanel.hidden = false;
    detailPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    showToast(error.message);
  }
}

async function signIn(event) {
  event.preventDefault();
  loginButton.disabled = true;
  try {
    const values = new FormData(loginForm);
    const result = await apiRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: values.get("username"),
        password: values.get("password"),
      }),
    });
    setAuthenticated(result.admin);
    currentPage = 1;
    await loadApplications();
  } catch (error) {
    showToast(error.message);
  } finally {
    loginButton.disabled = false;
  }
}

async function signOut() {
  try {
    await apiRequest("/api/admin/logout", { method: "POST" });
    setAuthenticated(null);
    detailPanel.hidden = true;
  } catch (error) {
    showToast(error.message);
  }
}

async function saveApplicationStatus() {
  if (!selectedAdmissionNumber) {
    return;
  }
  saveStatus.disabled = true;
  try {
    const result = await apiRequest(
      `/api/admin/applications/${encodeURIComponent(selectedAdmissionNumber)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: detailStatus.value,
          rejectionReason: rejectionReason.value.trim(),
        }),
      },
    );
    if (detailStatus.value === "rejected") {
      if (result.notification.sent) {
        const message = result.notification.reason === "already_sent"
          ? "Application rejected. The decision email was already sent."
          : "Application rejected. The decision email was sent to the student.";
        showToast(message);
      } else {
        const reason = result.notification.reason === "not_configured"
          ? "Email is not configured."
          : result.notification.reason === "missing_student_email"
            ? "No student email is on file."
            : "Email delivery failed.";
        showToast(`Status saved, but the rejection email was not sent. ${reason} Save again to retry.`);
      }
    } else {
      showToast("Application status updated.");
    }
    await loadApplications();
  } catch (error) {
    showToast(error.message);
  } finally {
    saveStatus.disabled = false;
  }
}

loginForm.addEventListener("submit", signIn);
logoutButton.addEventListener("click", signOut);
filterForm.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPage = 1;
  loadApplications();
});
previousPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    loadApplications();
  }
});
nextPage.addEventListener("click", () => {
  if (currentPage * pageSize < totalResults) {
    currentPage += 1;
    loadApplications();
  }
});
document.querySelector("#closeDetails").addEventListener("click", () => {
  detailPanel.hidden = true;
});
saveStatus.addEventListener("click", saveApplicationStatus);
detailStatus.addEventListener("change", updateRejectionReasonField);

apiRequest("/api/admin/session")
  .then(({ admin }) => {
    setAuthenticated(admin);
    return admin ? loadApplications() : null;
  })
  .catch((error) => {
    setAuthenticated(null);
    showToast(`Could not verify admin session: ${error.message}`);
  });
