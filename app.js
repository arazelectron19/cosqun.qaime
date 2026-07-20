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

// BÖYÜDÜLMÜŞ VƏ OPTİMAL ÖLÇÜLÜ BİLDİRİŞ FUNKSİYASI
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
        padding: '14px 28px',          
        borderRadius: '8px',
        color: '#ffffff',
        fontWeight: '600',             
        fontSize: '15px',              
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'all 0.3s ease',
        opacity: '0',
        transform: 'translateY(-20px)'
    });

    if (type === 'success') {
        notification.style.backgroundColor = '#10b981';
        notification.style.borderLeft = '6px solid #047857';
    } else {
        notification.style.backgroundColor = '#ef4444';
        notification.style.borderLeft = '6px solid #b91c1c';
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
    itemsBody.innerHTML = '';
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;

        const tr = document.createElement('tr');
        // Sütunlar sola (left) hizalandı
        tr.innerHTML = `
            <td style="text-align: left; padding: 10px 5px;">${index + 1}</td>
            <td style="text-align: left; padding: 10px 5px;"><input type="text" class="item-name" value="${item.name || ''}" placeholder="Məhsulun adı"></td>
            <td style="text-align: left; padding: 10px 5px;"><input type="number" class="item-qty" value="${item.qty}" style="width: 60px;"></td>
            <td style="text-align: left; padding: 10px 5px;"><input type="number" class="item-price" value="${item.price || ''}" step="0.01" placeholder="0.00" style="width: 80px;"></td>
            <td style="text-align: left; padding: 10px 5px; font-weight: 600;" class="row-total-display">${rowTotal.toFixed(2)} AZN</td>
            <td style="text-align: left; padding: 10px 5px;"><button class="btn-delete-row">×</button></td>
        `;

        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const rowTotalDisplay = tr.querySelector('.row-total-display');
        const btnDeleteRow = tr.querySelector('.btn-delete-row');

        // CUSTOM DROPDOWN GÖSTƏRMƏ MƏNTİQİ
        // nameInput-un 'focus' hadisəsində bu hissəni dəyişin:
// app.js faylında nameInput-un 'input' hadisəsini bu şəkildə dəyişin:
nameInput.addEventListener('input', (e) => {
    item.name = e.target.value;
    const dropdown = document.getElementById('custom-dropdown');
    
    if (e.target.value.length >= 0) { // 0 yazırıq ki, focus olanda da açılsın
        // Dropdown-u mütləq body-yə əlavə edirik
        if (dropdown.parentNode !== document.body) document.body.appendChild(dropdown);
        
        const rect = nameInput.getBoundingClientRect();
        
        // Kilitlənməni təmin edən hissə: 
        // position: fixed istifadə etdiyimiz üçün scrollY əlavə etmirik
        dropdown.style.position = 'fixed';
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.width = `${rect.width}px`;
        dropdown.style.display = 'block';
        
        dropdown.setAttribute('data-target-index', index);
        filterDropdownItems(e.target.value, dropdown);
    }
});

nameInput.addEventListener('input', (e) => {
    item.name = e.target.value;
    const dropdown = document.getElementById('custom-dropdown');
    
    if (e.target.value.length >= 0) {
        if (dropdown.parentNode !== document.body) document.body.appendChild(dropdown);
        
        const rect = nameInput.getBoundingClientRect();
        
        // Səhifənin scroll-undan asılı olmayaraq, birbaşa ekran koordinatlarını tətbiq edirik
        dropdown.style.position = 'fixed'; 
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.width = `${rect.width}px`;
        dropdown.style.display = 'block';
        
        dropdown.setAttribute('data-target-index', index);
        filterDropdownItems(e.target.value, dropdown);
    }
});

// 'focus' hadisəsini sadəcə silin və ya boş saxlayın ki, klikləyəndə avtomatik açılmasın.
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
        dItem.innerHTML = `<span>${prod.name}</span> <span style="float:right; opacity:0.6;">${prod.price} AZN</span>`;
        
        // Məhsul seçimi üçün mousedown hadisəsi
        dItem.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Inputun focus-unu itirməsinin qarşısını alır
            const targetIndex = parseInt(dropdown.getAttribute('data-target-index'));
            invoiceItems[targetIndex].name = prod.name;
            invoiceItems[targetIndex].price = parseFloat(prod.price) || 0;
            renderItems();
            dropdown.style.display = 'none';
        });
        
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

// html2pdf.bundle.min.js CDN-dən yüklənir. Mobil şəbəkədə bu, kompüterə
// nisbətən daha gec yükənə bilər - əgər istifadəçi "Paylaş" düyməsinə skript
// tam yüklənmədən klikləsə, "html2pdf is not defined" xətası yaranır.
// Bu funksiya kitabxananın hazır olmasını (müəyyən müddətə qədər) gözləyir.
function waitForHtml2Pdf(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        if (typeof window.html2pdf !== 'undefined') {
            return resolve();
        }
        const startTime = Date.now();
        const intervalId = setInterval(() => {
            if (typeof window.html2pdf !== 'undefined') {
                clearInterval(intervalId);
                resolve();
            } else if (Date.now() - startTime > timeoutMs) {
                clearInterval(intervalId);
                reject(new Error('html2pdf kitabxanası yüklənmədi (internet bağlantısını yoxlayın)'));
            }
        }, 150);
    });
}

async function generateAndSharePDF() {
    const customerName = customerInput.value.trim() || "Müştəri";
    const selectedDate = dateInput ? dateInput.value : "";

    let formattedDate = "";
    if (selectedDate) {
        const parts = selectedDate.split("-");
        formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
    } else {
        const now = new Date();
        formattedDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    }

    if (invoiceItems.length === 1 && !invoiceItems[0].name.trim()) {
        return showNotification("Boş qaimə paylaşıla bilməz!", "error");
    }

    const originalBtnText = btnSharePdf.innerHTML;
    btnSharePdf.disabled = true;
    btnSharePdf.innerHTML = "⌛ Hazırlanır...";

    // PDF kitabxanasının hazır olmasını gözləyirik
    try {
        if (typeof window.html2pdf === 'undefined') {
            btnSharePdf.innerHTML = "⌛ Kitabxana yüklənir...";
        }
        await waitForHtml2Pdf();
    } catch (waitError) {
        console.error(waitError);
        showNotification("PDF kitabxanası yüklənmədi. İnterneti yoxlayıb yenidən cəhd edin.", "error");
        btnSharePdf.disabled = false;
        btnSharePdf.innerHTML = originalBtnText;
        return;
    }

    let tableRowsHTML = "";
    let grandTotal = 0;

    invoiceItems.forEach((item, index) => {
        const rowTotal = (item.qty || 1) * (item.price || 0);
        grandTotal += rowTotal;
        tableRowsHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; color:#000; font-size: 12px;">${index + 1}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #000000; font-size: 12px;">${item.name || ''}</td>
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; color: #000000; font-size: 12px;">${item.qty}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0; color: #000000; font-size: 12px;">${item.price.toFixed(2)}</td>
                <td style="padding: 8px; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #000000; font-size: 12px;">${rowTotal.toFixed(2)}</td>
            </tr>
        `;
    });

    const invoiceInnerHTML = `
        <div style="width: 950px; padding: 32px; background-color: #ffffff; font-family: Arial, sans-serif; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;">
                <div>
                    <h1 style="font-size: 22px; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.5px;">SATIŞ QAİMƏSİ</h1>
                    <p style="margin: 12px 0 4px 0; font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: bold; letter-spacing: 0.5px;">KİMƏ (MÜŞTƏRİ):</p>
                    <div style="font-size: 14px; font-weight: bold; color: #000000; border-bottom: 2px solid #000000; padding-bottom: 3px; display: inline-block; min-width: 180px;">
                        ${customerName}
                    </div>
                    <p style="margin: 8px 0 0 0; font-size: 11px; color: #475569;">📅 <strong>Tarix:</strong> ${formattedDate}</p>
                </div>
                <div style="text-align: right; font-family: sans-serif;">
                    <h2 style="font-size: 17px; font-weight: 800; margin: 0; color: #000000;">ARAZ ELECTRON</h2>
                    <p style="font-size: 10px; color: #475569; margin: 3px 0 8px 0;">Elektronika və Texniki Dəstək Xidmətləri</p>
                    <div style="font-size: 9px; color: #64748b; line-height: 1.5;">
                        <p style="margin: 1px 0;">📍 Beyləqan r. Magistral yol</p>
                        <p style="margin: 1px 0;">🌐 arazelectron.com</p>
                        <p style="margin: 1px 0;">✉️ info@arazelectron.com</p>
                        <p style="margin: 1px 0;">📞 +994514280906</p>
                    </div>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
                <thead>
                    <tr style="border-bottom: 3px solid #000000;">
                        <th style="width: 8%; padding: 8px 6px; text-align: center; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #000000;">#</th>
                        <th style="width: 47%; padding: 8px; text-align: left; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #000000;">Məhsulun Adı</th>
                        <th style="width: 15%; padding: 8px; text-align: center; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #000000;">Miqdar</th>
                        <th style="width: 15%; padding: 8px; text-align: right; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #000000;">Qiymət</th>
                        <th style="width: 15%; padding: 8px; text-align: right; font-weight: 800; text-transform: uppercase; font-size: 10px; color: #000000;">Cəmi</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRowsHTML}
                </tbody>
            </table>

            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px;">
                <div style="width: 120px;">
                    <img src="${new URL('./mohur.png', window.location.href).href}" crossorigin="anonymous" style="display: block; width: 100%; height: auto;">
                </div>
                <div style="text-align: right; padding-bottom: 14px;">
                    <span style="font-size: 13px; color: #475569; font-weight: bold;">Yekun Ödəniş:</span>
                    <span style="font-size: 20px; font-weight: 900; color: #000000; margin-left: 8px;">${grandTotal.toFixed(2)} AZN</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 56px; font-size: 11px; color: #475569; font-weight: bold; padding-top: 14px;">
                Blokbitaniya və HadDiskə zəmanət verilirmir.
            </div>
        </div>
    `;

    // ƏSAS SƏBƏB: index.html-dəki viewport meta-teqi "width=1024, initial-scale=0.4"
    // saxlayır və .app-container-in zoom:1.75-i var. Bəzi mobil brauzerlər viewport
    // meta-teqinin JS ilə CANLI dəyişdirilməsinə düzgün/dərhal reaksiya vermir, ona
    // görə əvvəlki "müvəqqəti sıfırlama" üsulu bəzi telefonlarda kifayət etmirdi.
    //
    // Bu dəfə daha etibarlı yol: qaimə HTML-ni ana səhifədən TAM TƏCRİD OLUNMUŞ,
    // öz sıfırdan təmiz sənədi olan bir <iframe> daxilində qururuq. İframe-in öz
    // sənədində HEÇ bir viewport meta-teqi yoxdur, ona görə o, ana səhifənin
    // zoom/viewport tənzimləmələrindən TAM MÜSTƏQİLDİR.
    const pdfFrame = document.createElement('iframe');
    pdfFrame.className = 'pdf-render-frame';
    document.body.appendChild(pdfFrame);

    const pdfOverlay = document.createElement('div');
    pdfOverlay.className = 'pdf-render-overlay';
    pdfOverlay.innerHTML = `<div class="loading-spinner"></div>`;
    document.body.appendChild(pdfOverlay);

    const cleanup = () => {
        if (document.body.contains(pdfFrame)) pdfFrame.remove();
        if (document.body.contains(pdfOverlay)) pdfOverlay.remove();
    };

    try {
        const frameDoc = pdfFrame.contentDocument;
        frameDoc.open();
        frameDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#ffffff;">${invoiceInnerHTML}</body></html>`);
        frameDoc.close();

        // Möhür şəklinin (mohur.png) tam yüklənməsini gözləyirik. Əks halda
        // html2canvas şəkil hazır olmadan capture edə bilər.
        const imagesInFrame = Array.from(frameDoc.querySelectorAll('img'));
        await Promise.all(imagesInFrame.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        }));

        // Brauzerin iframe daxilində layout/paint etməsi üçün bir neçə frame gözləyirik
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 200));

        // İframe-in hündürlüyünü real məzmuna uyğunlaşdırırıq ki, heç nə kəsilməsin
        const contentHeight = frameDoc.body.scrollHeight || 600;
        pdfFrame.style.height = `${contentHeight}px`;

        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        console.log('[PDF DEBUG] iframe body rect:', frameDoc.body.getBoundingClientRect());
        console.log('[PDF DEBUG] iframe body scrollWidth/scrollHeight:', frameDoc.body.scrollWidth, frameDoc.body.scrollHeight);

        const pageWidth = frameDoc.body.scrollWidth || 800;
        const pageHeight = frameDoc.body.scrollHeight || 600;

        const opt = {
            margin:       0,
            filename:     `Qaime_${customerName.replace(/\s+/g, '_')}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: true },
            jsPDF:        { unit: 'px', format: [pageWidth, pageHeight], orientation: 'portrait' }
        };

        let pdfBlob;
        try {
            pdfBlob = await html2pdf().set(opt).from(frameDoc.body).output('blob');
        } catch (innerError) {
            console.error('[PDF DEBUG] Birinci cəhd uğursuz oldu, "a4" formatı ilə yenidən sınanılır:', innerError);
            const fallbackOpt = { ...opt, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } };
            pdfBlob = await html2pdf().set(fallbackOpt).from(frameDoc.body).output('blob');
        }

        if (!pdfBlob || pdfBlob.size < 1000) {
            console.warn('[PDF DEBUG] Şübhəli kiçik PDF ölçüsü:', pdfBlob ? pdfBlob.size : 'no blob');
        }

        cleanup();

        const file = new File([pdfBlob], `Qaime_${customerName.replace(/\s+/g, '_')}.pdf`, { type: 'application/pdf' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Satış Qaiməsi' });
        } else {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(pdfBlob);
            link.download = `Qaime_${customerName.replace(/\s+/g, '_')}.pdf`;
            link.click();
            showNotification("PDF yükləndi!", "success");
        }
    } catch (error) {
        console.error(error);
        showNotification("Xəta: " + (error && error.message ? error.message : String(error)), "error");
        cleanup();
    } finally {
        btnSharePdf.disabled = false;
        btnSharePdf.innerHTML = originalBtnText;
    }
}