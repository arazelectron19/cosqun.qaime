// 1. Bütün lazım olan Firestore metodlarını və db-ni təhlükəsiz şəkildə yalnız bir yerdən import edirik
import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    query, 
    orderBy, 
    serverTimestamp,
    doc, 
    updateDoc, 
    deleteDoc, 
    where 
} from "./firebase.js";

// 2. Service Worker qeydiyyatı
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: '/cosqun.qaime/' })
        .then(() => console.log("Service Worker aktivləşdirildi."))
        .catch(err => console.error("SW qeydiyyat xətası:", err));
}

function showNotification(message, type = 'success') {
    const oldNotification = document.getElementById('custom-notification');
    if (oldNotification) oldNotification.remove();

    const notification = document.createElement('div');
    notification.id = 'custom-notification';
    notification.innerText = message;

    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 24px',
        borderRadius: '6px',
        color: '#ffffff',
        fontWeight: 'bold',
        fontSize: '14px',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateY(-20px)'
    });

    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.borderLeft = '5px solid #047857';
    } else {
        notification.style.backgroundColor = '#ef4444';
        notification.style.borderLeft = '5px solid #b91c1c';
    }

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

const itemsBody = document.getElementById('invoice-items-body');
const btnAddItem = document.getElementById('btn-add-item');
const customerInput = document.getElementById('customer-input');
const totalPriceView = document.getElementById('total-price-view');
const waitingListContainer = document.getElementById('waiting-list-container');
const btnNewInvoice = document.getElementById('btn-new-invoice');
const selectTemplate = document.getElementById('select-template');
const dateInput = document.getElementById('invoice-date-input');
const btnSharePdf = document.getElementById('btn-share-pdf');

let invoiceItems = [{ name: '', qty: 1, price: 0 }];
let currentActiveDocId = null;
let dbProductsList = []; // Bazadan gələn sürətli məhsullar bura yığılacaq

document.addEventListener('DOMContentLoaded', () => {
    renderItems();
    fetchWaitingList();
    loadGlobalProductsAndTemplates();
    setTodayDate(); // Səhifə açılanda bu günün tarixini avtomatik yazır
    
    // Dropdown-dan seçim klik məntiqi
    const dropdown = document.getElementById('custom-dropdown');
    if (dropdown) {
        dropdown.addEventListener('click', (e) => {
            const itemEl = e.target.closest('.dropdown-item');
            if (!itemEl) return;

            const targetIndex = parseInt(dropdown.getAttribute('data-target-index'));
            if (isNaN(targetIndex)) return;

            invoiceItems[targetIndex].name = itemEl.textContent;
            invoiceItems[targetIndex].price = parseFloat(itemEl.dataset.price) || 0;
            
            renderItems();
            dropdown.style.display = 'none';
        });

        document.addEventListener('click', (e) => {
            if (!e.target.classList.contains('item-name') && !e.target.closest('#custom-dropdown')) {
                dropdown.style.display = 'none';
            }
        });
    }
});

function setTodayDate() {
    if (dateInput) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISODate = (new Date(now - offset)).toISOString().slice(0, 10);
        dateInput.value = localISODate;
    }
}

// Firebase-dən həm məhsul siyahısını, həm də şablonları çəkirik
async function loadGlobalProductsAndTemplates() {
    try {
        // 1. Məhsulları alaq
        const pSnap = await getDocs(query(collection(db, "base_products"), orderBy("name")));
        dbProductsList = [];
        pSnap.forEach(d => dbProductsList.push(d.data()));

        // 2. Şablonları dropdown-a dolduraq
        if (selectTemplate) {
            const tSnap = await getDocs(collection(db, "base_templates"));
            selectTemplate.innerHTML = '<option value="">-- Şablon seçilməyib --</option>';
            tSnap.forEach(docSnapshot => {
                const tData = docSnapshot.data();
                const option = document.createElement('option');
                option.value = docSnapshot.id;
                option.textContent = tData.templateName;
                option.dataset.items = JSON.stringify(tData.items);
                selectTemplate.appendChild(option);
            });
        }
    } catch (e) {
        console.error("İlkin data yüklənmə xətası:", e);
    }
}

if (btnNewInvoice) {
    btnNewInvoice.addEventListener('click', () => {
        btnNewInvoice.classList.add('clicked');
        setTimeout(() => btnNewInvoice.classList.remove('clicked'), 500);
        resetForm(); 
    });
}

function renderItems() {
    if (!itemsBody) return;
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="text-align: center; font-weight: bold; color: #a5b4fc; padding-top:14px;">${index + 1}</td>
            <td><input type="text" class="item-name" value="${item.name || ''}" placeholder="Məhsulun adı" autocomplete="off"></td>
            <td><input type="number" class="item-qty text-center" value="${item.qty}"></td>
            <td><input type="number" class="item-price text-right" value="${item.price || ''}" step="0.01" placeholder="0.00"></td>
            <td style="text-align: right; font-weight: 600; padding-top:14px; min-width:80px;" class="row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td><button class="btn-delete-row">×</button></td>
        `;

        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        // CUSTOM DROPDOWN GÖSTƏRMƏ MƏNTİQİ
        nameInput.addEventListener('focus', () => {
            const dropdown = document.getElementById('custom-dropdown');
            if (!dropdown) return;

            // Əgər bazada heç bir məhsul yoxdursa dropdown açılmasın
            if (dbProductsList.length === 0) return;

            // Mövqeni hesablayırıq
            const wrapper = document.querySelector('.invoice-table-wrapper');
            const rect = nameInput.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();

            dropdown.style.left = `${rect.left - wrapperRect.left + wrapper.scrollLeft}px`;
            dropdown.style.top = `${rect.bottom - wrapperRect.top + wrapper.scrollTop}px`;
            dropdown.style.width = `${rect.width}px`;
            dropdown.setAttribute('data-target-index', index);
            
            // Dropdown elementlərini süzgəcdən keçirib doldururuq
            filterDropdownItems(nameInput.value, dropdown);
        });

        nameInput.addEventListener('input', (e) => { 
            item.name = e.target.value; 
            const dropdown = document.getElementById('custom-dropdown');
            if (dropdown && dropdown.style.display === 'block') {
                filterDropdownItems(e.target.value, dropdown);
            }
        });

        qtyInput.addEventListener('input', (e) => {
            item.qty = parseInt(e.target.value) || 0;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        priceInput.addEventListener('input', (e) => {
            item.price = parseFloat(e.target.value) || 0;
            rowTotalDisplay.textContent = (item.qty * item.price).toFixed(2) + " AZN";
            fastCalculateTotal();
        });

        qtyInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });
        priceInput.addEventListener('focus', (e) => { if(e.target.value == '0') e.target.value = ''; });

        btnDeleteRow.addEventListener('click', () => {
            if(invoiceItems.length === 1) {
                invoiceItems = [{ name: '', qty: 1, price: 0 }];
            } else {
                invoiceItems.splice(index, 1);
            }
            renderItems();
        });

        itemsBody.appendChild(tr);
    });

    if (totalPriceView) totalPriceView.textContent = grandTotal.toFixed(2);
}

// Dropdown içində axtarış və render funksiyası
function filterDropdownItems(filterText, dropdown) {
    dropdown.innerHTML = '';
    const queryStr = filterText.toLowerCase().trim();
    
    const filtered = dbProductsList.filter(p => p.name.toLowerCase().includes(queryStr));
    
    if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    filtered.forEach(prod => {
        const dItem = document.createElement('div');
        dItem.className = 'dropdown-item';
        dItem.textContent = prod.name;
        // Klik hadisəsi zamanı qiyməti də inputa oturtmaq üçün məlumat saxlayırıq
        dItem.dataset.price = prod.price; 
        dropdown.appendChild(dItem);
    });

    dropdown.style.display = 'block';
}

function fastCalculateTotal() {
    const total = invoiceItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    if (totalPriceView) totalPriceView.textContent = total.toFixed(2);
}

if (btnAddItem) {
    btnAddItem.addEventListener('click', () => {
        btnAddItem.classList.add('clicked');
        setTimeout(() => btnAddItem.classList.remove('clicked'), 500);
        invoiceItems.push({ name: '', qty: 1, price: 0 });
        renderItems();
    });
}

const btnWaiting = document.getElementById('btn-waiting');
if (btnWaiting) {
    btnWaiting.addEventListener('click', async () => {
        btnWaiting.classList.add('clicked');
        setTimeout(() => btnWaiting.classList.remove('clicked'), 500);

        const customerName = customerInput.value.trim();
        const isFirstItemEmpty = invoiceItems.length === 1 && !invoiceItems[0].name.trim();

        if (!customerName || isFirstItemEmpty) {
            return showNotification("Müştəri adı və məhsul əlavə edin", "error");
        }

        // Tarix seçimini yoxlayıb Date obyektinə çeviririk
        const selectedDate = dateInput && dateInput.value ? new Date(dateInput.value) : new Date();

        const data = {
            customerName: customerName,
            items: invoiceItems,
            status: "waiting",
            updatedAt: selectedDate // Seçilmiş tarix Firebase-ə yazılır
        };

        try {
            if (currentActiveDocId) {
                await updateDoc(doc(db, "waiting_invoices", currentActiveDocId), data);
                showNotification("Qaimə uğurla yeniləndi!", "success");
            } else {
                await addDoc(collection(db, "waiting_invoices"), data);
                showNotification("Qaimə gözləməyə alındı!", "success");
            }
            resetForm();
            await fetchWaitingList();
        } catch (e) { 
            console.error(e); 
            showNotification("Xəta baş verdi!", "error");
        }
    });
}

async function fetchWaitingList() {
    if (!waitingListContainer) return;
    waitingListContainer.innerHTML = '<div class="loading-wrapper"><div class="sharp-ring-loader"></div></div>';
    try {
        // YALNIZ statusa görə süzürük (Bu zaman indeks TƏLƏB OLUNMUR)
        const q = query(
            collection(db, "waiting_invoices"), 
            where("status", "==", "waiting")
        );
        const snap = await getDocs(q);
        waitingListContainer.innerHTML = '';

        if(snap.empty) {
            waitingListContainer.innerHTML = '<p style="font-size:12px; color:#9ca3af; text-align:center;">Gözləyən iş yoxdur.</p>';
            return;
        }

        // Gələn məlumatları JavaScript tərəfində tarixinə görə azalan sıra ilə düzürük (İndekssiz sıralama)
        const docsArray = [];
        snap.forEach(docSnap => {
            docsArray.push({ id: docSnap.id, ...docSnap.data() });
        });

        docsArray.sort((a, b) => {
            const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt).getTime();
            const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt).getTime();
            return timeB - timeA; // Yenidən köhnəyə sıralama
        });

        // Artıq sıralanmış massiv üzərindən render edirik
        docsArray.forEach((data) => {
            const docId = data.id;
            const formattedDate = formatDate(data.updatedAt);

            const div = document.createElement('div');
            div.className = 'waiting-item';
            div.innerHTML = `
                <div style="flex:1;" class="info-area">
                    <strong style="color:#ffffff;">${data.customerName}</strong>
                    <span style="display:block; font-size:11px; color:#a5b4fc; margin-top:2px;">${data.items.length} məhsul</span>
                    <span style="display:block; font-size:10px; color:#9ca3af; margin-top:4px;">📅 ${formattedDate}</span>
                </div>
                <div class="action-area" style="display:flex; align-items:center;">
                    <button class="btn-delete-waiting">Sil</button>
                </div>
            `;

            div.addEventListener('click', (e) => {
                if(e.target.closest('.btn-delete-waiting') || e.target.closest('.waiting-item-confirm-box')) return;
                currentActiveDocId = docId;
                customerInput.value = data.customerName;
                invoiceItems = data.items;

                // Bazadan gələn tarixi tarix inputuna düzgün formatda oturdur
                if (dateInput && data.updatedAt) {
                    const dateObj = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
                    const offset = dateObj.getTimezoneOffset() * 60000;
                    const localISODate = (new Date(dateObj - offset)).toISOString().slice(0, 10);
                    dateInput.value = localISODate;
                }

                renderItems();
                if (btnWaiting) btnWaiting.textContent = 'Yenilə';
            });

            const btnDelete = div.querySelector('.btn-delete-waiting');
            const actionArea = div.querySelector('.action-area');

            btnDelete.addEventListener('click', (e) => {
                e.stopPropagation();
                btnDelete.style.display = 'none';
                
                const confirmBox = document.createElement('div');
                confirmBox.className = 'waiting-item-confirm-box';
                confirmBox.innerHTML = `
                    <span>Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:3px 8px; margin:0 3px; cursor:pointer; border-radius:3px;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:3px 8px; margin:0 3px; cursor:pointer; border-radius:3px;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "waiting_invoices", docId));
                        if (currentActiveDocId === docId) resetForm();
                        fetchWaitingList();
                        showNotification("Qaimə uğurla silindi!", "success");
                    } catch (err) {
                        showNotification("Silmək mümkün olmadı!", "error");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    btnDelete.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            waitingListContainer.appendChild(div);
        });
    } catch (e) { 
        console.error(e); 
    }
}

const btnRefresh = document.getElementById('btn-refresh');
if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
        btnRefresh.classList.add('clicked');
        await fetchWaitingList();
        setTimeout(() => btnRefresh.classList.remove('clicked'), 250);
    });
}

function resetForm() {
    if (customerInput) customerInput.value = '';
    if (selectTemplate) selectTemplate.selectedIndex = 0; // Yeni qaimə yaradanda şablon seçimi sıfırlansın
    invoiceItems = [{ name: '', qty: 1, price: 0 }];
    currentActiveDocId = null;
    setTodayDate(); // Yeni qaimə yaradanda tarixi bu günə sıfırlayır
    renderItems();
    if (btnWaiting) btnWaiting.textContent = 'Gözləməyə Al';
}

const btnSettings = document.getElementById('btn-settings');
if (btnSettings) {
    btnSettings.addEventListener('click', (e) => {
        e.preventDefault();
        btnSettings.classList.add('clicked');
        setTimeout(() => {
            btnSettings.classList.remove('clicked');
            window.location.href = btnSettings.getAttribute('href');
        }, 500);
    });
}

// Şablon Seçim Məntiqi
if (selectTemplate) {
    selectTemplate.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        if (!selectedOption || !selectedOption.value) return; 
        
        try {
            const templateItems = JSON.parse(selectedOption.dataset.items);
            if (templateItems && templateItems.length > 0) {
                invoiceItems = templateItems.map(item => ({
                    name: item.name,
                    qty: item.qty || 1,
                    price: item.price || 0
                }));
                renderItems();
            }
        } catch (err) {
            console.error("Şablon tətbiq xətası:", err);
        }
    });
}

// Tarixi oxunaqlı formata salan funksiya
function formatDate(firestoreTimestamp) {
    if (!firestoreTimestamp) return "";

    // Firestore-dan gələn Timestamp obyektini JS Date obyektinə çeviririk
    const date = firestoreTimestamp.toDate ? firestoreTimestamp.toDate() : new Date(firestoreTimestamp);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

// PDF generasiya və paylaşma məntiqi
if (btnSharePdf) {
    btnSharePdf.addEventListener('click', async () => {
        btnSharePdf.classList.add('clicked');
        setTimeout(() => btnSharePdf.classList.remove('clicked'), 500);
        await generateAndSharePDF();
    });
}

async function generateAndSharePDF() {
    const customerName = customerInput.value.trim() || "Müştəri";
    const selectedDate = dateInput ? dateInput.value : "";
    
    // Tarixi Gün.Ay.İl formatına salırıq
    let formattedDate = "";
    if (selectedDate) {
        const parts = selectedDate.split("-");
        if (parts.length === 3) {
            formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
    } else {
        const now = new Date();
        formattedDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    }

    if (invoiceItems.length === 1 && !invoiceItems[0].name.trim()) {
        return showNotification("Boş qaimə paylaşıla bilməz!", "error");
    }

    // Mobil cihazın bu funksiyanı dəstəklədiyini ilk öncə yoxlayırıq
    if (!navigator.canShare) {
        return showNotification("Cihazınız birbaşa PDF paylaşmağı dəstəkləmir!", "error");
    }

    const originalBtnText = btnSharePdf.innerHTML;
    btnSharePdf.disabled = true;
    btnSharePdf.innerHTML = "⌛ Hazırlanır...";

    // PDF üçün çap şablonunu gizli konteynerdə yaradırıq
    const printContainer = document.createElement('div');
    printContainer.className = 'pdf-render-hidden';

    let tableRowsHTML = "";
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = (item.qty || 1) * (item.price || 0);
        grandTotal += rowTotal;
        tableRowsHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0;">${index + 1}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #000000;">${item.name || ''}</td>
                <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #000000;">${item.qty}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0; color: #000000;">${item.price.toFixed(2)}</td>
                <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #000000;">${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    printContainer.innerHTML = `
        <div style="padding: 40px; background-color: #ffffff; font-family: Arial, sans-serif;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                <div>
                    <h1 style="font-size: 28px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.5px;">SATIŞ QAİMƏSİ</h1>
                    <p style="margin: 15px 0 5px 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px;">KİMƏ (MÜŞTƏRİ):</p>
                    <div style="font-size: 18px; font-weight: bold; color: #000000; border-bottom: 2px solid #000000; padding-bottom: 4px; display: inline-block; min-width: 220px;">
                        ${customerName}
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 13px; color: #475569;">📅 <strong>Tarix:</strong> ${formattedDate}</p>
                </div>
                <div style="text-align: right; font-family: sans-serif;">
                    <h2 style="font-size: 22px; font-weight: 800; margin: 0; color: #000000;">ARAZ ELECTRON</h2>
                    <p style="font-size: 12px; color: #475569; margin: 4px 0 12px 0;">Elektronika və Texniki Dəstək Xidmətləri</p>
                    <div style="font-size: 11px; color: #64748b; line-height: 1.6;">
                        <p style="margin: 2px 0;">📍 Beyləqan r. Magistral yol</p>
                        <p style="margin: 2px 0;">🌐 arazelectron.com</p>
                        <p style="margin: 2px 0;">✉️ info@arazelectron.com</p>
                        <p style="margin: 2px 0;">📞 +994514280906</p>
                    </div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                    <tr style="border-bottom: 3px solid #000000;">
                        <th style="width: 8%; padding: 12px 6px; text-align: center; font-weight: 800; text-transform: uppercase; font-size: 12px; color: #000000;">#</th>
                        <th style="width: 47%; padding: 12px; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 12px; color: #000000;">Məhsulun Adı</th>
                        <th style="width: 15%; padding: 12px; text-align: center; font-weight: 800; text-transform: uppercase; font-size: 12px; color: #000000;">Miqdar</th>
                        <th style="width: 15%; padding: 12px; text-align: right; font-weight: 800; text-transform: uppercase; font-size: 12px; color: #000000;">Qiymət</th>
                        <th style="width: 15%; padding: 12px; text-align: right; font-weight: 800; text-transform: uppercase; font-size: 12px; color: #000000;">Cəmi</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHTML}
                </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px;">
                <div style="position: relative; width: 220px; height: 220px;">
                    <img src="./mohur.png" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: contain; position: absolute; left: 0; bottom: 0;">
                </div>
                <div style="text-align: right; padding-bottom: 20px;">
                    <span style="font-size: 16px; color: #475569; font-weight: bold;">Yekun Ödəniş:</span>
                    <span style="font-size: 26px; font-weight: 900; color: #000000; margin-left: 10px;">${grandTotal.toFixed(2)} AZN</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 80px; font-size: 13px; color: #475569; font-weight: bold; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
                Araz Electron bizi seçdiyiniz üçün təşəkkür edir!
            </div>
        </div>
    `;

    document.body.appendChild(printContainer);

    const opt = {
        margin:       0,
        filename:     `Qaime_${customerName.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    try {
        const pdfBlob = await html2pdf().set(opt).from(printContainer).output('blob');
        printContainer.remove(); // Generasiyadan sonra elementi təmizləyirik

        const fileName = `Qaime_${customerName.replace(/\s+/g, '_')}.pdf`;
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

        const shareData = {
            files: [file],
            title: `Qaimə - ${customerName}`,
            text: `Araz Electron Satış Qaiməsi`
        };

        if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
        } else {
            showNotification("Brauzeriniz fayl paylaşmağı dəstəkləmir!", "error");
        }
    } catch (error) {
        console.error("Paylaşma xətası:", error);
        // İstifadəçi paylaşma pəncərəsini sadəcə bağlayıbsa xəta bildirişi çıxarmırıq
        if (error.name !== "AbortError") {
            showNotification("PDF paylaşıla bilmədi!", "error");
        }
        if (document.body.contains(printContainer)) {
            printContainer.remove();
        }
    } finally {
        btnSharePdf.disabled = false;
        btnSharePdf.innerHTML = originalBtnText;
    }
}