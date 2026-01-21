/**
 * Converts an array of objects to a CSV string and triggers a file download.
 *
 * @param {Array<Object>} data - The data to export. Each object represents a row.
 * @param {string} filename - The name of the file to download (e.g., 'export.csv').
 */
export const downloadCSV = (data, filename) => {
  if (!data || !data.length) {
    console.warn('No data to export');
    return;
  }

  // Extract headers
  const headers = Object.keys(data[0]);
  
  // Create CSV header row
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(fieldName => {
        let value = row[fieldName];
        // Handle null/undefined
        if (value === null || value === undefined) {
          return '';
        }
        // Escape quotes and wrap in quotes if contains comma or newline
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create a Blob
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility

  // Create link and trigger download
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
