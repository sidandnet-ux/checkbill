
const STORAGE_KEY = "quotation_items_v1";

let items = [];

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    items = Array.isArray(saved) ? saved : [];
  } catch {
    items = [];
  }
  renderTable();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function addRow(data = {}) {
  items.push({
    item: data.item || "",
    quantity: Number(data.quantity) || 0,
    price: Number(data.price) || 0,
    discount: Number(data.discount) || 0
  });

  renderTable();
}

function updateItem(index, field, value) {
  if (!items[index]) return;

  if (field === "item") {
    items[index][field] = value;
  } else {
    const number = Number(value);
    items[index][field] = Number.isFinite(number)
      ? Math.max(0, number)
      : 0;
  }

  renderTable();
}

function deleteRow(index) {
  items.splice(index, 1);
  renderTable();
}

function calculate(item) {
  const quantity = item.quantity;
  const price = item.price;
  const discountPercent = item.discount;

  const subtotal = quantity * price;
  const discount = subtotal * discountPercent / 100;
  const netPrice = price * (1 - discountPercent / 100);
  const total = subtotal - discount;

  return {
    subtotal,
    discount,
    netPrice,
    total
  };
}

function money(value) {
  return "₹" + value.toFixed(2);
}

function renderTable() {
  const tbody = document.getElementById("tableBody");

  tbody.innerHTML = "";

  let subtotal = 0;
  let totalDiscount = 0;
  let grandTotal = 0;

  items.forEach((item, index) => {
    const result = calculate(item);

    subtotal += result.subtotal;
    totalDiscount += result.discount;
    grandTotal += result.total;

    const tr = document.createElement("tr");

    const serial = document.createElement("td");
    serial.textContent = index + 1;
    tr.appendChild(serial);

    function addInput(field, value, type) {
      const td = document.createElement("td");
      const input = document.createElement("input");

      input.type = type;
      input.value = value;

      if (type === "number") {
        input.min = "0";
        input.step = "any";
        if (field === "discount") input.max = "100";
      }

      input.addEventListener("change", () => {
        updateItem(index, field, input.value);
      });

      td.appendChild(input);
      tr.appendChild(td);
    }

    addInput("item", item.item, "text");
    addInput("quantity", item.quantity, "number");
    addInput("price", item.price, "number");
    addInput("discount", item.discount, "number");

    [result.discount, result.netPrice, result.total].forEach(value => {
      const td = document.createElement("td");
      td.className = "calculated";
      td.textContent = money(value);
      tr.appendChild(td);
    });

    const action = document.createElement("td");
    action.className = "no-print";

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "Delete";
    del.onclick = () => deleteRow(index);

    action.appendChild(del);
    tr.appendChild(action);

    tbody.appendChild(tr);
  });

  document.getElementById("subtotal").textContent =
    money(subtotal);

  document.getElementById("discountTotal").textContent =
    money(totalDiscount);

  document.getElementById("grandTotal").textContent =
    money(grandTotal);

  saveData();
}

function clearAll() {
  if (!confirm("Delete all items?")) return;

  items = [];
  renderTable();
}

function exportCSV() {
  const headers = [
    "S.No", "Item", "Quantity", "Unit Price",
    "Discount %", "Discount", "Net Price", "Total"
  ];

  const rows = items.map((item, index) => {
    const result = calculate(item);

    return [
      index + 1,
      item.item,
      item.quantity,
      item.price,
      item.discount,
      result.discount.toFixed(2),
      result.netPrice.toFixed(2),
      result.total.toFixed(2)
    ];
  });

  const csv = [headers, ...rows]
    .map(row => row.map(value =>
      '"' + String(value).replace(/"/g, '""') + '"'
    ).join(","))
    .join("\r\n");

  downloadFile(
    "\uFEFF" + csv,
    "quotation.csv",
    "text/csv;charset=utf-8;"
  );
}

function importCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const rows = parseCSV(reader.result);
      const headers = rows.shift().map(h =>
        h.trim().toLowerCase()
      );

      const get = (row, name, fallback) => {
        const index = headers.indexOf(name);
        return index >= 0 ? row[index] : fallback;
      };

      const imported = rows
        .filter(row => row.some(v => v.trim() !== ""))
        .map(row => ({
          item: get(row, "item", ""),
          quantity: parseNumber(get(row, "quantity", "0")),
          price: parseNumber(get(row, "unit price", "0")),
          discount: Math.min(
            100,
            parseNumber(get(row, "discount %", "0"))
          )
        }));

      if (confirm("Replace existing items with imported data?")) {
        items = imported;
      } else {
        items.push(...imported);
      }

      renderTable();
      alert("Import completed!");
    } catch (error) {
      alert("Unable to import CSV. Please check the file format.");
    }

    event.target.value = "";
  };

  reader.readAsText(file);
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"' && quoted && text[i + 1] === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

loadData();
