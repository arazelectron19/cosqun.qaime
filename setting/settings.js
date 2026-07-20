import { db } from "../firebase.js"; 
import { 
    collection, 
    addDoc, 
    getDocs, 
    deleteDoc, 
    updateDoc, 
    doc,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const productForm = document.getElementById('product-form');
const templateForm = document.getElementById('template-form');
const baseProductsList = document.getElementById('base-products-list');
const templateProductsSelector = document.getElementById('template-products-selector');
const baseTemplatesList = document.getElementById('base-templates-list');

let allGlobalProducts = [];

// DAHA OPTİMAL VƏ STANDART ÖLÇÜLÜ BİLDİRİŞ FUNKSİYASI
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
        notification.style.backgroundColor = '#10b981'; // Yaşıl
        notification.style.borderLeft = '5px solid #059669'; 
    } else {
        notification.style.backgroundColor = '#ef4444'; // Qırmızı
        notification.style.borderLeft = '5px solid #dc2626'; 
    }

    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 20);

    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => notification.remove(), 300);
    }, 3000); 
}

document.addEventListener('DOMContentLoaded', () => {
    loadSettingsData();
});

async function loadSettingsData() {
    await fetchBaseProducts();
    await fetchBaseTemplates();
}

async function fetchBaseProducts() {
    if (!baseProductsList || !templateProductsSelector) return;
    
    baseProductsList.innerHTML = 'Yüklənir...';
    templateProductsSelector.innerHTML = '';

    try {
        const q = query(collection(db, "base_products"), orderBy("name"));
        const snap = await getDocs(q);
        
        baseProductsList.innerHTML = '';
        allGlobalProducts = [];

        if (snap.empty) {
            baseProductsList.innerHTML = '<p style="color:#9ca3af; font-size:12px;">Baza boşdur.</p>';
            templateProductsSelector.innerHTML = '<p style="color:#9ca3af; font-size:12px;">Əvvəlcə məhsul əlavə edin.</p>';
            return;
        }

        snap.forEach((docSnapshot) => {
            const prod = docSnapshot.data();
            const prodId = docSnapshot.id;
            
            allGlobalProducts.push({ id: prodId, ...prod });

            const pDiv = document.createElement('div');
            pDiv.className = 'setting-row-item';
            pDiv.id = `product-row-${prodId}`;
            pDiv.innerHTML = `
                <div class="product-info-display">
                    <strong class="prod-name">${prod.name}</strong> 
                    <span class="prod-price" style="color: #5bc0be; margin-left: 10px;">${prod.price.toFixed(2)} AZN</span>
                </div>
                <div class="action-area" style="display:inline-flex; align-items:center;">
                    <button class="btn-edit-setting" onclick="enableProductEdit('${prodId}', '${prod.name.replace(/'/g, "\\'")}', ${prod.price})">✏️</button>
                    <button class="btn-delete-setting" data-id="${prodId}">Sil</button>
                </div>
            `;
            
            const btnDeleteProd = pDiv.querySelector('.btn-delete-setting');
            const actionArea = pDiv.querySelector('.action-area');

            btnDeleteProd.addEventListener('click', (e) => {
                e.stopPropagation();
                btnDeleteProd.style.display = 'none';

                const editBtn = pDiv.querySelector('.btn-edit-setting');
                if (editBtn) editBtn.style.display = 'none';

                const confirmBox = document.createElement('div');
                confirmBox.className = 'setting-item-confirm-box';
                confirmBox.style.display = 'inline-flex';
                confirmBox.style.alignItems = 'center';
                confirmBox.innerHTML = `
                    <span style="font-size:12px; color:#ef4444; margin-right:5px; font-weight:bold;">Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "base_products", prodId));
                        showNotification("Məhsul uğurla silindi!", "success");
                        loadSettingsData();
                    } catch (err) {
                        console.error("Məhsul silinmədi:", err);
                        showNotification("Məhsulu silmək mümkün olmadı!", "error");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    btnDeleteProd.style.display = 'block';
                    if (editBtn) editBtn.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            baseProductsList.appendChild(pDiv);

            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `
                <div class="checkbox-left">
                    <input type="checkbox" value="${prodId}" data-name="${prod.name}" data-price="${prod.price}">
                    <span style="font-weight: 500;">${prod.name}</span>
                </div>
                <span class="checkbox-price-tag">${prod.price.toFixed(2)} AZN</span>
            `;

            const checkbox = label.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    label.classList.add('checked-active');
                } else {
                    label.classList.remove('checked-active');
                }
            });

            templateProductsSelector.appendChild(label);
        });
    } catch (e) {
        console.error(e);
    }
}

window.enableProductEdit = function(id, currentName, currentPrice) {
    const row = document.getElementById(`product-row-${id}`);
    if (!row) return;

    row.innerHTML = `
        <div class="edit-input-group">
            <input type="text" class="edit-input-name" id="edit-name-${id}" value="${currentName}" autocomplete="off">
            <input type="number" class="edit-input-price" id="edit-price-${id}" value="${currentPrice}" step="0.01" autocomplete="off">
        </div>
        <div class="action-buttons" style="margin-left: 8px;">
            <button class="btn-save-edit" onclick="saveProductEdit('${id}')">💾</button>
            <button class="btn-cancel-edit" onclick="cancelProductEdit('${id}', '${currentName.replace(/'/g, "\\'")}', ${currentPrice})">❌</button>
        </div>
    `;
}

window.cancelProductEdit = function(id, name, price) {
    const row = document.getElementById(`product-row-${id}`);
    if (!row) return;

    row.innerHTML = `
        <div class="product-info-display">
            <strong class="prod-name">${name}</strong> 
            <span class="prod-price" style="color: #5bc0be; margin-left: 10px;">${Number(price).toFixed(2)} AZN</span>
        </div>
        <div class="action-area" style="display:inline-flex; align-items:center;">
            <button class="btn-edit-setting" onclick="enableProductEdit('${id}', '${name.replace(/'/g, "\\'")}', ${price})">✏️</button>
            <button class="btn-delete-setting" data-id="${id}">Sil</button>
        </div>
    `;

    const btnDeleteProd = row.querySelector('.btn-delete-setting');
    const actionArea = row.querySelector('.action-area');

    btnDeleteProd.addEventListener('click', (e) => {
        e.stopPropagation();
        btnDeleteProd.style.display = 'none';

        const editBtn = row.querySelector('.btn-edit-setting');
        if (editBtn) editBtn.style.display = 'none';

        const confirmBox = document.createElement('div');
        confirmBox.className = 'setting-item-confirm-box';
        confirmBox.style.display = 'inline-flex';
        confirmBox.style.alignItems = 'center';
        confirmBox.innerHTML = `
            <span style="font-size:12px; color:#ef4444; margin-right:5px; font-weight:bold;">Silinsin?</span>
            <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Bəli</button>
            <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Xeyr</button>
        `;

        confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
            eSub.stopPropagation();
            try {
                await deleteDoc(doc(db, "base_products", id));
                showNotification("Məhsul sistemdən silindi!", "success");
                loadSettingsData();
            } catch (err) {
                console.error("Məhsul silinmədi:", err);
                showNotification("Məhsulu silmək mümkün olmadı!", "error");
            }
        });

        confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
            eSub.stopPropagation();
            confirmBox.remove();
            btnDeleteProd.style.display = 'block';
            if (editBtn) editBtn.style.display = 'block';
        });

        actionArea.appendChild(confirmBox);
    });
}

window.saveProductEdit = async function(id) {
    const newName = document.getElementById(`edit-name-${id}`).value.trim();
    const newPrice = parseFloat(document.getElementById(`edit-price-${id}`).value);

    if (!newName || isNaN(newPrice)) {
        showNotification("Zəhmət olmasa ad və qiyməti düzgün daxil edin!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "base_products", id), { 
            name: newName, 
            price: newPrice 
        });
        showNotification("Məhsul məlumatları yeniləndi!", "success");
        await loadSettingsData();
    } catch (error) {
        console.error("Xəta baş verdi:", error);
        showNotification("Məlumatı yeniləmək mümkün olmadı!", "error");
    }
}

if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('setting-item-name');
        const priceInput = document.getElementById('setting-item-price');

        const name = nameInput.value.trim();
        const price = parseFloat(priceInput.value) || 0;

        if (!name) {
            showNotification("Məhsul adı boş ola bilməz!", "error");
            return;
        }

        try {
            await addDoc(collection(db, "base_products"), { name, price });
            showNotification("Yeni məhsul bazaya əlavə edildi!", "success");
            nameInput.value = '';
            priceInput.value = '';
            loadSettingsData();
        } catch(err) {
            console.error(err);
            showNotification("Məhsul əlavə edilərkən xəta baş verdi!", "error");
        }
    });
}

if (templateForm) {
    templateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const templateNameInput = document.getElementById('template-name');
        const tName = templateNameInput.value.trim();

        if (!tName) {
            showNotification("Şablon adı daxil edin!", "error");
            return;
        }

        const checkedBoxes = templateProductsSelector.querySelectorAll('input[type="checkbox"]:checked');
        const selectedItems = [];

        checkedBoxes.forEach(box => {
            selectedItems.push({
                name: box.getAttribute('data-name'),
                price: parseFloat(box.getAttribute('data-price')) || 0,
                qty: 1
            });
        });

        if (selectedItems.length === 0) {
            showNotification("Şablona ən azı bir məhsul seçməlisiniz!", "error");
            return;
        }

        try {
            await addDoc(collection(db, "base_templates"), {
                templateName: tName,
                items: selectedItems
            });
            showNotification("Yeni şablon uğurla yaradıldı!", "success");
            templateNameInput.value = '';
            loadSettingsData();
        } catch (err) {
            console.error(err);
            showNotification("Şablon yaradıla bilmədi!", "error");
        }
    });
}

async function fetchBaseTemplates() {
    if (!baseTemplatesList) return;
    
    baseTemplatesList.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <span>Şablonlar yüklənir...</span>
        </div>
    `;

    try {
        const snap = await getDocs(collection(db, "base_templates"));
        baseTemplatesList.innerHTML = '';

        if (snap.empty) {
            baseTemplatesList.innerHTML = '<p style="color:#9ca3af; font-size:12px;">Şablon tapılmadı.</p>';
            return;
        }

        snap.forEach((docSnapshot) => {
            const tData = docSnapshot.data();
            const tId = docSnapshot.id;

            const tDiv = document.createElement('div');
            tDiv.className = 'setting-row-item';
            tDiv.style.display = 'flex';
            tDiv.style.justifyContent = 'space-between';
            tDiv.style.alignItems = 'center';
            tDiv.style.padding = '12px 6px';

            tDiv.innerHTML = `
                <div>
                    <strong style="font-size: 15px; color: #fff;">${tData.templateName}</strong>
                    <span style="font-size:12px; color:#9ca3af; display:block; margin-top:2px;">(${tData.items.length} məhsul daxildir)</span>
                </div>
                <div class="action-area" style="display:inline-flex; align-items:center; gap: 8px;">
                    <button class="btn-edit-setting" style="background-color: #f59e0b; padding: 6px 10px; border-radius: 4px; border: none; cursor: pointer; color: white;" onclick="openTemplateModal('${tId}', '${tData.templateName.replace(/'/g, "\\'")}')">✏️</button>
                    <button class="btn-delete-setting" style="background-color:#ef4444; padding: 6px 10px; border-radius: 4px; border: none; cursor: pointer; color: white;">Sil</button>
                </div>
            `;

            const btnDeleteTemplate = tDiv.querySelector('.btn-delete-setting');
            const actionArea = tDiv.querySelector('.action-area');

            btnDeleteTemplate.addEventListener('click', (e) => {
                e.stopPropagation();
                btnDeleteTemplate.style.display = 'none';
                const editBtn = tDiv.querySelector('.btn-edit-setting');
                if (editBtn) editBtn.style.display = 'none';

                const confirmBox = document.createElement('div');
                confirmBox.className = 'setting-item-confirm-box';
                confirmBox.style.display = 'inline-flex';
                confirmBox.style.alignItems = 'center';
                confirmBox.innerHTML = `
                    <span style="font-size:12px; color:#ef4444; margin-right:5px; font-weight:bold;">Silinsin?</span>
                    <button class="btn-confirm-yes" style="background:#ef4444; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Bəli</button>
                    <button class="btn-confirm-no" style="background:#4b5563; color:#fff; border:none; padding:4px 8px; margin:0 3px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:bold;">Xeyr</button>
                `;

                confirmBox.querySelector('.btn-confirm-yes').addEventListener('click', async (eSub) => {
                    eSub.stopPropagation();
                    try {
                        await deleteDoc(doc(db, "base_templates", tId));
                        showNotification("Şablon uğurla silindi!", "success");
                        loadSettingsData();
                    } catch (err) {
                        console.error("Şablon silinmədi:", err);
                        showNotification("Şablon silinə bilmədi!", "error");
                    }
                });

                confirmBox.querySelector('.btn-confirm-no').addEventListener('click', (eSub) => {
                    eSub.stopPropagation();
                    confirmBox.remove();
                    btnDeleteTemplate.style.display = 'block';
                    if (editBtn) editBtn.style.display = 'block';
                });

                actionArea.appendChild(confirmBox);
            });

            baseTemplatesList.appendChild(tDiv);
        });
    } catch (e) {
        console.error(e);
        baseTemplatesList.innerHTML = '<p style="color:#ef4444; font-size:12px;">Şablonları yükləyərkən xəta baş verdi.</p>';
    }
}

window.openTemplateModal = async function(tId, currentName) {
    const modal = document.getElementById('template-modal');
    const idInput = document.getElementById('modal-template-id');
    const nameInput = document.getElementById('modal-template-name');
    const checkboxesContainer = document.getElementById('modal-template-checkboxes');

    if (!modal || !idInput || !nameInput || !checkboxesContainer) return;

    idInput.value = tId;
    nameInput.value = currentName;
    checkboxesContainer.innerHTML = 'Məhsullar yüklənir...';

    modal.style.display = 'flex';

    try {
        const tempDoc = allGlobalProducts;
        const templateSnap = await getDocs(collection(db, "base_templates"));
        let currentTemplateItems = [];
        
        templateSnap.forEach(d => {
            if (d.id === tId) {
                currentTemplateItems = d.data().items || [];
            }
        });

        checkboxesContainer.innerHTML = '';

        tempDoc.forEach(prod => {
            const isChecked = currentTemplateItems.some(item => item.name === prod.name);

            const label = document.createElement('label');
            label.style.display = 'flex';
            label.style.alignItems = 'center';
            label.style.justifyContent = 'space-between';
            label.style.padding = '10px 14px';
            label.style.background = isChecked ? 'rgba(91, 192, 190, 0.1)' : '#16162a';
            label.style.border = isChecked ? '1px solid #5bc0be' : '1px solid #2e2e4f';
            label.style.borderRadius = '8px';
            label.style.cursor = 'pointer';
            label.style.fontSize = '14px';
            label.style.color = '#e2e8f0';
            label.style.transition = 'all 0.15s ease';

            label.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px;">
                    <input type="checkbox" value="${prod.id}" data-name="${prod.name}" data-price="${prod.price}" ${isChecked ? 'checked' : ''} style="accent-color: #5bc0be; width:16px; height:16px; cursor:pointer;">
                    <span>${prod.name}</span>
                </div>
                <span style="color: #5bc0be; font-weight: bold;">${prod.price.toFixed(2)} AZN</span>
            `;

            const cb = label.querySelector('input[type="checkbox"]');
            cb.addEventListener('change', () => {
                if (cb.checked) {
                    label.style.background = 'rgba(91, 192, 190, 0.1)';
                    label.style.borderColor = '#5bc0be';
                } else {
                    label.style.background = '#16162a';
                    label.style.borderColor = '#2e2e4f';
                }
            });

            checkboxesContainer.appendChild(label);
        });

    } catch (err) {
        console.error("Məhsul siyahılaşdırılması zamanı xəta:", err);
        checkboxesContainer.innerHTML = 'Məhsulları yükləmək mümkün olmadı.';
    }
}

window.closeTemplateModal = function() {
    const modal = document.getElementById('template-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

window.saveTemplateModalFromModal = async function() {
    const tId = document.getElementById('modal-template-id').value;
    const nameInput = document.getElementById('modal-template-name');
    const checkboxesContainer = document.getElementById('modal-template-checkboxes');

    if (!tId || !nameInput || !checkboxesContainer) return;

    const newTemplateName = nameInput.value.trim();
    if (!newTemplateName) {
        showNotification("Şablon adı boş ola bilməz!", "error");
        return;
    }

    const checkedBoxes = checkboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
    const updatedItems = [];

    checkedBoxes.forEach(box => {
        updatedItems.push({
            name: box.getAttribute('data-name'),
            price: parseFloat(box.getAttribute('data-price')) || 0,
            qty: 1
        });
    });

    if (updatedItems.length === 0) {
        showNotification("Şablonda ən azı bir məhsul saxlamalısınız!", "error");
        return;
    }

    try {
        await updateDoc(doc(db, "base_templates", tId), {
            templateName: newTemplateName,
            items: updatedItems
        });
        
        showNotification("Şablon uğurla yeniləndi!", "success");
        closeTemplateModal();
        loadSettingsData();
    } catch (error) {
        console.error("Şablon yenilənmədi:", error);
        showNotification("Yadda saxlamaq mümkün olmadı!", "error");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleHeader = document.getElementById('toggle-products-header');
    const productsList = document.getElementById('base-products-list');
    const headerArrow = document.getElementById('header-arrow');

    if (toggleHeader && productsList && headerArrow) {
        toggleHeader.addEventListener('click', () => {
            productsList.classList.toggle('active');
            headerArrow.classList.toggle('rotate-arrow');
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const toggleTemplateHeader = document.getElementById('toggle-template-header');
    const templateSelector = document.getElementById('template-products-selector');
    const templateArrow = document.getElementById('template-arrow');

    if (toggleTemplateHeader && templateSelector && templateArrow) {
        toggleTemplateHeader.addEventListener('click', () => {
            templateSelector.classList.toggle('active');
            templateArrow.classList.toggle('rotate-arrow');
        });
    }
});