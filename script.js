// データストレージ（LocalStorageを使用）
let products = [];
let exchangeRates = {
    usdToRmb: 7.20,
    usdToVnd: 24000
};

// 輸送形態別の標準数量
const shippingQuantities = {
    fcl: 18900,
    flexi: 22000,
    iso: 23500
};

// システム設定
let systemSettings = {
    royaltyRate: 3.0,
    autoSave: true,
    autoSaveDelay: 3000
};

// 自動保存タイマー
let autoSaveTimer = null;

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded イベント発生');
    
    // データ読み込み
    loadData();
    console.log('データ読み込み完了。製品数:', products.length);
    
    // メインページの製品選択肢更新
    populateProductSelect();
    
    // 管理者ページかどうかチェック
    const isAdminPage = document.getElementById('editable-products-body') !== null;
    console.log('管理者ページ:', isAdminPage);
    
    if (isAdminPage) {
        // 管理者ページの場合
        console.log('管理者ページの初期化開始');
        
        // システム設定読み込み
        loadSystemSettings();
        
        // 編集可能テーブル表示
        setTimeout(function() {
            displayEditableProducts();
        }, 100);
        
        console.log('管理者ページの初期化完了');
    }
    
    // 原料費入力時の変換表示
    const rawCostInput = document.getElementById('new-raw-cost');
    if (rawCostInput) {
        rawCostInput.addEventListener('input', updateRawCostConversion);
    }
});

// データの読み込み
function loadData() {
    console.log('loadData関数開始');
    
    const savedProducts = localStorage.getItem('products');
    const savedRates = localStorage.getItem('exchangeRates');
    
    if (savedProducts) {
        try {
            products = JSON.parse(savedProducts);
            console.log('保存された製品データを読み込み:', products.length, '個');
            
            // 既存データに rawCostOriginal がない場合の対応
            products.forEach(function(product) {
                if (!product.rawCostOriginal && product.rawCost) {
                    product.rawCostOriginal = (product.rawCost * 1000 * exchangeRates.usdToRmb).toFixed(2);
                }
                // shippingCostsが存在しない場合の対応
                if (!product.shippingCosts) {
                    product.shippingCosts = { fcl: 0, flexi: 0, iso: 0 };
                }
            });
        } catch (error) {
            console.error('製品データの読み込みエラー:', error);
            products = [];
        }
    } else {
        console.log('保存された製品データがないため、デフォルトデータを作成');
        // デフォルト製品データ
        products = [
            {
                id: 1,
                name: '製品A',
                rawCost: 0.6944,
                rawCostOriginal: 5000,
                variableCost: 0.05,
                containerCost: 0.05,
                shippingCosts: {
                    fcl: 1200.0,
                    flexi: 1500.0,
                    iso: 1800.0
                }
            },
            {
                id: 2,
                name: '製品B',
                rawCost: 0.4167,
                rawCostOriginal: 3000,
                variableCost: 0.08,
                containerCost: 0.08,
                shippingCosts: {
                    fcl: 1800.0,
                    flexi: 2200.0,
                    iso: 2600.0
                }
            }
        ];
        saveProducts();
    }
    
    if (savedRates) {
        try {
            exchangeRates = JSON.parse(savedRates);
        } catch (error) {
            console.error('為替レートの読み込みエラー:', error);
        }
    }
    
    console.log('loadData関数完了。最終製品数:', products.length);
}

// 原料費の変換関数
function convertRawCost(rmbPerTon) {
    // RMB/トン から USD/kg への変換
    // 1トン = 1000kg
    const rmbPerKg = rmbPerTon / 1000;
    const usdPerKg = rmbPerKg / exchangeRates.usdToRmb;
    return usdPerKg;
}

// 原料費変換の表示更新
function updateRawCostConversion() {
    const rmbPerTon = parseFloat(document.getElementById('new-raw-cost').value) || 0;
    const usdPerKg = convertRawCost(rmbPerTon);
    const convertedElement = document.getElementById('raw-cost-converted');
    if (convertedElement) {
        convertedElement.textContent = '= $' + usdPerKg.toFixed(4) + '/kg (USD)';
    }
}

// データの保存
function saveProducts() {
    localStorage.setItem('products', JSON.stringify(products));
}

function saveExchangeRates() {
    const usdRmb = document.getElementById('usd-rmb');
    const usdVnd = document.getElementById('usd-vnd');
    
    if (usdRmb && usdVnd) {
        exchangeRates.usdToRmb = parseFloat(usdRmb.value);
        exchangeRates.usdToVnd = parseFloat(usdVnd.value);
        localStorage.setItem('exchangeRates', JSON.stringify(exchangeRates));
    }
}

// 製品選択肢の更新
function populateProductSelect() {
    const select = document.getElementById('product');
    if (!select) return;
    
    select.innerHTML = '<option value="">製品を選択してください</option>';
    
    products.forEach(function(product) {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        select.appendChild(option);
    });
}

// 輸送形態名の取得
function getShippingTypeName(type) {
    const names = {
        'fcl': 'FCL(20ft)',
        'flexi': 'Flexi',
        'iso': 'ISO'
    };
    return names[type] || '-';
}

// 輸送形態別の数量を取得
function getQuantityByShippingType(type) {
    return shippingQuantities[type] || 0;
}

// 計算の更新
function updateCalculation() {
    const productId = document.getElementById('product').value;
    const shippingType = document.getElementById('shipping-type').value;
    const price = parseFloat(document.getElementById('price').value) || 0;
    const currency = document.getElementById('currency').value;
    
    if (!productId || !shippingType || price <= 0) {
        clearResults();
        const productInfo = document.getElementById('product-info');
        if (productInfo) {
            productInfo.style.display = 'none';
        }
        return;
    }
    
    const product = products.find(function(p) { return p.id == productId; });
    if (!product || !product.shippingCosts[shippingType]) return;
    
    // 輸送形態に応じた数量を取得
    const quantity = getQuantityByShippingType(shippingType);
    const totalShippingCost = product.shippingCosts[shippingType];
    const logisticsUnitPrice = totalShippingCost / quantity;
    
    // 製品・輸送情報の表示
    const productQuantity = document.getElementById('product-quantity');
    const selectedShipping = document.getElementById('selected-shipping');
    const totalShippingCostEl = document.getElementById('total-shipping-cost');
    const logisticsUnitPriceEl = document.getElementById('logistics-unit-price');
    const productInfo = document.getElementById('product-info');
    
    if (productQuantity) productQuantity.textContent = quantity + 'kg';
    if (selectedShipping) selectedShipping.textContent = getShippingTypeName(shippingType);
    if (totalShippingCostEl) totalShippingCostEl.textContent = '$' + totalShippingCost.toFixed(2);
    if (logisticsUnitPriceEl) logisticsUnitPriceEl.textContent = '$' + logisticsUnitPrice.toFixed(4) + '/kg';
    if (productInfo) productInfo.style.display = 'block';
    
    // USD基準で計算
    let priceUSD = price;
    if (currency === 'RMB') {
        priceUSD = price / exchangeRates.usdToRmb;
    } else if (currency === 'VND') {
        priceUSD = price / exchangeRates.usdToVnd;
    }
    
    // コスト計算 (kg単価ベース)
    const rawCost = product.rawCost;
    const variableCost = product.variableCost;
    const royaltyCost = priceUSD * getRoyaltyRate(); // 設定された率を使用
    const logisticsCost = logisticsUnitPrice; // 選択された輸送形態の運賃単価
    const containerCost = product.containerCost;
    
    const totalCost = rawCost + variableCost + royaltyCost + logisticsCost + containerCost;
    const profitUSD = priceUSD - totalCost;
    const profitRate = (profitUSD / priceUSD) * 100;
    
    // 各通貨での利益額
    const profitRMB = profitUSD * exchangeRates.usdToRmb;
    const profitVND = profitUSD * exchangeRates.usdToVnd;
    
    // 結果の表示
    const profitRateEl = document.getElementById('profit-rate');
    const profitUsdEl = document.getElementById('profit-usd');
    const profitRmbEl = document.getElementById('profit-rmb');
    const profitVndEl = document.getElementById('profit-vnd');
    
    if (profitRateEl) profitRateEl.textContent = profitRate.toFixed(1) + '%';
    if (profitUsdEl) profitUsdEl.textContent = '$' + profitUSD.toFixed(4);
    if (profitRmbEl) profitRmbEl.textContent = '¥' + profitRMB.toFixed(4);
    if (profitVndEl) profitVndEl.textContent = '₫' + Math.round(profitVND).toLocaleString();
    
    // コスト内訳の表示
    const rawCostEl = document.getElementById('raw-cost');
    const variableCostEl = document.getElementById('variable-cost');
    const royaltyCostEl = document.getElementById('royalty-cost');
    const logisticsCostEl = document.getElementById('logistics-cost');
    const containerCostEl = document.getElementById('container-cost');
    const totalCostEl = document.getElementById('total-cost');
    
    if (rawCostEl) rawCostEl.textContent = '$' + rawCost.toFixed(4);
    if (variableCostEl) variableCostEl.textContent = '$' + variableCost.toFixed(4);
    if (royaltyCostEl) royaltyCostEl.textContent = '$' + royaltyCost.toFixed(4);
    if (logisticsCostEl) logisticsCostEl.textContent = '$' + logisticsCost.toFixed(4);
    if (containerCostEl) containerCostEl.textContent = '$' + containerCost.toFixed(4);
    if (totalCostEl) totalCostEl.textContent = '$' + totalCost.toFixed(4);
}

// 結果のクリア
function clearResults() {
    const elements = ['profit-rate', 'profit-usd', 'profit-rmb', 'profit-vnd', 
                     'raw-cost', 'variable-cost', 'royalty-cost', 'logistics-cost', 
                     'container-cost', 'total-cost'];
    
    elements.forEach(function(id) {
        const element = document.getElementById(id);
        if (element) {
            if (id === 'profit-rate') {
                element.textContent = '--%';
            } else if (id.includes('vnd')) {
                element.textContent = '₫0';
            } else if (id.includes('rmb')) {
                element.textContent = '¥0.00';
            } else {
                element.textContent = '$0.00';
            }
        }
    });
}

// システム設定の読み込み
function loadSystemSettings() {
    console.log('システム設定を読み込み中...');
    
    const savedSettings = localStorage.getItem('systemSettings');
    if (savedSettings) {
        systemSettings = Object.assign(systemSettings, JSON.parse(savedSettings));
    }
    
    // 輸送形態別数量の読み込み
    const savedQuantities = localStorage.getItem('shippingQuantities');
    if (savedQuantities) {
        Object.assign(shippingQuantities, JSON.parse(savedQuantities));
    }
    
    // UIに反映
    const usdRmb = document.getElementById('usd-rmb');
    const usdVnd = document.getElementById('usd-vnd');
    const fclQuantity = document.getElementById('fcl-quantity');
    const flexiQuantity = document.getElementById('flexi-quantity');
    const isoQuantity = document.getElementById('iso-quantity');
    const royaltyRate = document.getElementById('royalty-rate');
    
    if (usdRmb) usdRmb.value = exchangeRates.usdToRmb;
    if (usdVnd) usdVnd.value = exchangeRates.usdToVnd;
    if (fclQuantity) fclQuantity.value = shippingQuantities.fcl;
    if (flexiQuantity) flexiQuantity.value = shippingQuantities.flexi;
    if (isoQuantity) isoQuantity.value = shippingQuantities.iso;
    if (royaltyRate) royaltyRate.value = systemSettings.royaltyRate;
    
    console.log('システム設定読み込み完了');
}

// 輸送形態別数量の保存
function saveShippingQuantities() {
    const fclQuantity = document.getElementById('fcl-quantity');
    const flexiQuantity = document.getElementById('flexi-quantity');
    const isoQuantity = document.getElementById('iso-quantity');
    
    if (fclQuantity) shippingQuantities.fcl = parseInt(fclQuantity.value);
    if (flexiQuantity) shippingQuantities.flexi = parseInt(flexiQuantity.value);
    if (isoQuantity) shippingQuantities.iso = parseInt(isoQuantity.value);
    
    localStorage.setItem('shippingQuantities', JSON.stringify(shippingQuantities));
    showSaveIndicator('saved', '数量設定を保存しました');
}

// 計算設定の保存
function saveCalculationSettings() {
    const royaltyRate = document.getElementById('royalty-rate');
    if (royaltyRate) {
        systemSettings.royaltyRate = parseFloat(royaltyRate.value);
        localStorage.setItem('systemSettings', JSON.stringify(systemSettings));
        showSaveIndicator('saved', '計算設定を保存しました');
    }
}

// 新製品追加
function addNewProduct() {
    console.log('=== addNewProduct 開始 ===');
    
    // テーブルボディの存在確認
    const tbody = document.getElementById('editable-products-body');
    if (!tbody) {
        console.error('❌ テーブルボディが見つかりません');
        alert('エラー: テーブルが見つかりません。ページを再読み込みしてください。');
        return;
    }
    
    const newProduct = {
        id: Date.now(),
        name: '新製品',
        rawCost: 0,
        rawCostOriginal: 0,
        variableCost: 0,
        containerCost: 0,
        shippingCosts: {
            fcl: 0,
            flexi: 0,
            iso: 0
        }
    };
    
    console.log('新製品オブジェクト作成:', newProduct);
    
    // 製品配列に追加
    products.push(newProduct);
    console.log('製品配列に追加完了。現在の製品数:', products.length);
    
    // テーブルを再描画
    try {
        displayEditableProducts();
        console.log('✅ テーブル再描画完了');
    } catch (error) {
        console.error('❌ テーブル再描画エラー:', error);
    }
    
    // メインページの製品選択肢も更新
    try {
        populateProductSelect();
        console.log('✅ 製品選択肢更新完了');
    } catch (error) {
        console.error('❌ 製品選択肢更新エラー:', error);
    }
    
    // 保存
    try {
        saveProducts();
        console.log('✅ 製品データ保存完了');
    } catch (error) {
        console.error('❌ 製品データ保存エラー:', error);
    }
    
    // 保存状態を表示
    showSaveIndicator('saved', '新製品を追加しました');
    
    console.log('=== addNewProduct 完了 ===');
    
    // 新しく追加された行の製品名セルにフォーカス
    setTimeout(function() {
        const newRow = document.querySelector('tr[data-product-id="' + newProduct.id + '"]');
        if (newRow) {
            const nameCell = newRow.querySelector('.editable-cell');
            if (nameCell) {
                console.log('新製品の名前セルにフォーカス');
                nameCell.click();
            }
        }
    }, 200);
}

// 編集可能テーブルの表示
function displayEditableProducts() {
    console.log('=== displayEditableProducts 開始 ===');
    console.log('製品数:', products.length);
    
    const tbody = document.getElementById('editable-products-body');
    console.log('テーブルボディ要素:', tbody);
    
    if (!tbody) {
        console.error('❌ editable-products-body が見つかりません！');
        console.log('利用可能な要素ID一覧:');
        const allElements = document.querySelectorAll('[id]');
        allElements.forEach(function(el) { console.log('- ' + el.id); });
        return;
    }
    
    // 既存の行をクリア
    tbody.innerHTML = '';
    console.log('既存の行をクリアしました');
    
    // 製品がない場合の表示
    if (products.length === 0) {
        console.log('製品がないため、空のメッセージを表示');
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="8" style="text-align: center; padding: 40px; color: #6b7280; font-size: 16px;">製品が登録されていません。<br>「+ 新製品追加」ボタンで製品を追加してください。</td>';
        tbody.appendChild(emptyRow);
        return;
    }
    
    // 各製品の行を作成
    console.log('製品行を作成中...');
    products.forEach(function(product, index) {
        console.log('製品 ' + (index + 1) + ': ' + product.name);
        try {
            const row = createEditableRow(product, index);
            tbody.appendChild(row);
            console.log('✅ 製品 ' + product.name + ' の行を追加');
        } catch (error) {
            console.error('❌ 製品 ' + product.name + ' の行作成エラー:', error);
        }
    });
    
    console.log('=== displayEditableProducts 完了 ===');
}

// 編集可能な行を作成
function createEditableRow(product, index) {
    const row = document.createElement('tr');
    row.dataset.productId = product.id;
    
    // 製品名セル
    const nameCell = document.createElement('td');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'editable-cell';
    nameDiv.textContent = product.name || '新製品';
    nameDiv.dataset.originalValue = product.name || '新製品';
    
    nameDiv.addEventListener('click', function() {
        editCell(nameDiv, 'text', function(value) {
            product.name = value;
            scheduleAutoSave();
        });
    });
    
    nameCell.appendChild(nameDiv);
    
    // 原料費セル（RMB/トン）
    const rawCostCell = document.createElement('td');
    const rawCostDiv = document.createElement('div');
    rawCostDiv.className = 'editable-cell converted-display';
    updateConvertedDisplay(rawCostDiv, product.rawCostOriginal || 0, product.rawCost || 0);
    
    rawCostDiv.addEventListener('click', function() {
        editCell(rawCostDiv, 'number', function(value) {
            const rmbPerTon = parseFloat(value) || 0;
            product.rawCostOriginal = rmbPerTon;
            product.rawCost = convertRawCost(rmbPerTon);
            updateConvertedDisplay(rawCostDiv, rmbPerTon, product.rawCost);
            scheduleAutoSave();
        }, product.rawCostOriginal || 0);
    });
    
    rawCostCell.appendChild(rawCostDiv);
    
    // 変動費セル
    const variableCostCell = document.createElement('td');
    const variableCostDiv = document.createElement('div');
    variableCostDiv.className = 'editable-cell number';
    variableCostDiv.textContent = (product.variableCost || 0).toFixed(4);
    variableCostDiv.dataset.originalValue = product.variableCost || 0;
    
    variableCostDiv.addEventListener('click', function() {
        editCell(variableCostDiv, 'number', function(value) {
            product.variableCost = parseFloat(value) || 0;
            scheduleAutoSave();
        });
    });
    
    variableCostCell.appendChild(variableCostDiv);
    
    // 容器費セル
    const containerCostCell = document.createElement('td');
    const containerCostDiv = document.createElement('div');
    containerCostDiv.className = 'editable-cell number';
    containerCostDiv.textContent = (product.containerCost || 0).toFixed(4);
    containerCostDiv.dataset.originalValue = product.containerCost || 0;
    
    containerCostDiv.addEventListener('click', function() {
        editCell(containerCostDiv, 'number', function(value) {
            product.containerCost = parseFloat(value) || 0;
            scheduleAutoSave();
        });
    });
    
    containerCostCell.appendChild(containerCostDiv);
    
    // FCL運賃セル
    const fclCostCell = document.createElement('td');
    const fclCostDiv = document.createElement('div');
    fclCostDiv.className = 'editable-cell number';
    fclCostDiv.textContent = (product.shippingCosts && product.shippingCosts.fcl ? product.shippingCosts.fcl : 0).toFixed(2);
    fclCostDiv.dataset.originalValue = product.shippingCosts && product.shippingCosts.fcl ? product.shippingCosts.fcl : 0;
    
    fclCostDiv.addEventListener('click', function() {
        editCell(fclCostDiv, 'number', function(value) {
            if (!product.shippingCosts) product.shippingCosts = {};
            product.shippingCosts.fcl = parseFloat(value) || 0;
            scheduleAutoSave();
        });
    });
    
    fclCostCell.appendChild(fclCostDiv);
    
    // Flexi運賃セル
    const flexiCostCell = document.createElement('td');
    const flexiCostDiv = document.createElement('div');
    flexiCostDiv.className = 'editable-cell number';
    flexiCostDiv.textContent = (product.shippingCosts && product.shippingCosts.flexi ? product.shippingCosts.flexi : 0).toFixed(2);
    flexiCostDiv.dataset.originalValue = product.shippingCosts && product.shippingCosts.flexi ? product.shippingCosts.flexi : 0;
    
    flexiCostDiv.addEventListener('click', function() {
        editCell(flexiCostDiv, 'number', function(value) {
            if (!product.shippingCosts) product.shippingCosts = {};
            product.shippingCosts.flexi = parseFloat(value) || 0;
            scheduleAutoSave();
        });
    });
    
    flexiCostCell.appendChild(flexiCostDiv);
    
    // ISO運賃セル
    const isoCostCell = document.createElement('td');
    const isoCostDiv = document.createElement('div');
    isoCostDiv.className = 'editable-cell number';
    isoCostDiv.textContent = (product.shippingCosts && product.shippingCosts.iso ? product.shippingCosts.iso : 0).toFixed(2);
    isoCostDiv.dataset.originalValue = product.shippingCosts && product.shippingCosts.iso ? product.shippingCosts.iso : 0;
    
    isoCostDiv.addEventListener('click', function() {
        editCell(isoCostDiv, 'number', function(value) {
            if (!product.shippingCosts) product.shippingCosts = {};
            product.shippingCosts.iso = parseFloat(value) || 0;
            scheduleAutoSave();
        });
    });
    
    isoCostCell.appendChild(isoCostDiv);
    
    // 削除ボタンセル
    const actionCell = document.createElement('td');
    actionCell.className = 'action-cell';
    actionCell.innerHTML = '<button class="delete-row-btn" onclick="deleteProductRow(' + product.id + ')">削除</button>';
    
    // 行に全てのセルを追加
    row.appendChild(nameCell);
    row.appendChild(rawCostCell);
    row.appendChild(variableCostCell);
    row.appendChild(containerCostCell);
    row.appendChild(fclCostCell);
    row.appendChild(flexiCostCell);
    row.appendChild(isoCostCell);
    row.appendChild(actionCell);
    
    return row;
}

// セル編集の共通関数
function editCell(cellDiv, type, onSave, originalValue) {
    if (originalValue === undefined) originalValue = null;
    if (cellDiv.classList.contains('editing')) return;
    
    const currentValue = originalValue !== null ? originalValue : cellDiv.dataset.originalValue;
    
    const input = document.createElement('input');
    input.type = type;
    input.value = currentValue;
    if (type === 'number') {
        input.step = '0.01';
    }
    
    cellDiv.classList.add('editing');
    cellDiv.innerHTML = '';
    cellDiv.appendChild(input);
    
    input.focus();
    input.select();
    
    function saveValue() {
        const newValue = input.value;
        cellDiv.classList.remove('editing');
        
        if (type === 'number') {
            const numValue = parseFloat(newValue) || 0;
            cellDiv.textContent = numValue.toFixed(4);
            cellDiv.dataset.originalValue = numValue;
        } else {
            cellDiv.textContent = newValue;
            cellDiv.dataset.originalValue = newValue;
        }
        
        if (onSave) {
            onSave(newValue);
        }
    }
    
    function cancelEdit() {
        cellDiv.classList.remove('editing');
        if (type === 'number') {
            const numValue = parseFloat(currentValue) || 0;
            cellDiv.textContent = numValue.toFixed(4);
        } else {
            cellDiv.textContent = currentValue;
        }
    }
    
    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveValue();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

// 変換表示の更新関数
function updateConvertedDisplay(cellDiv, original, converted) {
    if (cellDiv.classList.contains('editing')) return;
    
    cellDiv.innerHTML = '<span class="original">' + parseFloat(original || 0).toFixed(2) + ' RMB/トン</span><span class="converted">$' + parseFloat(converted || 0).toFixed(4) + '/kg</span>';
    cellDiv.dataset.originalValue = original || 0;
}

// 製品行削除
function deleteProductRow(id) {
    if (confirm('この製品を削除しますか？')) {
        products = products.filter(function(p) { return p.id !== id; });
        displayEditableProducts();
        populateProductSelect();
        saveProducts();
        showSaveIndicator('saved', '製品を削除しました');
    }
}


//すべて保存
function saveAllProducts() {
    saveProducts();
    showSaveIndicator('saved', 'すべての製品を保存しました');
}

// 自動保存のスケジュール
function scheduleAutoSave() {
    if (!systemSettings.autoSave) return;
    
    if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
    }
    
    showSaveIndicator('saving', '保存中...');
    
    autoSaveTimer = setTimeout(function() {
        saveProducts();
        populateProductSelect();
        showSaveIndicator('saved', '自動保存完了');
    }, systemSettings.autoSaveDelay);
}

// 保存状態インジケーター
function showSaveIndicator(type, message) {
    let indicator = document.getElementById('save-indicator');
    
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'save-indicator';
        indicator.className = 'save-indicator';
        document.body.appendChild(indicator);
    }
    
    indicator.className = 'save-indicator ' + type + ' show';
    indicator.textContent = message;
    
    if (type === 'saved') {
        setTimeout(function() {
            indicator.classList.remove('show');
        }, 2000);
    }
}

// ロイヤリティー率の動的取得
function getRoyaltyRate() {
    return systemSettings.royaltyRate / 100;
}

// 管理者ページ用関数（従来のフォーム用）
function loadExchangeRates() {
    const usdRmb = document.getElementById('usd-rmb');
    const usdVnd = document.getElementById('usd-vnd');
    
    if (usdRmb && usdVnd) {
        usdRmb.value = exchangeRates.usdToRmb;
        usdVnd.value = exchangeRates.usdToVnd;
    }
}

function saveProduct() {
    const editId = document.getElementById('edit-product-id').value;
    const name = document.getElementById('new-product-name').value;
    const rawCostRmbTon = parseFloat(document.getElementById('new-raw-cost').value);
    const variableCost = parseFloat(document.getElementById('new-variable-cost').value);
    const containerCost = parseFloat(document.getElementById('new-container-cost').value);
    const fclCost = parseFloat(document.getElementById('new-fcl-cost').value);
    const flexiCost = parseFloat(document.getElementById('new-flexi-cost').value);
    const isoCost = parseFloat(document.getElementById('new-iso-cost').value);
    
    if (!name || isNaN(rawCostRmbTon) || isNaN(variableCost) || isNaN(containerCost) || 
        isNaN(fclCost) || isNaN(flexiCost) || isNaN(isoCost)) {
        alert('すべての項目を正しく入力してください');
        return;
    }
    
    // 原料費をRMB/トンからUSD/kgに変換
    const rawCostUsdKg = convertRawCost(rawCostRmbTon);
    
    const productData = {
        name: name,
        rawCost: rawCostUsdKg,
        rawCostOriginal: rawCostRmbTon,
        variableCost: variableCost,
        containerCost: containerCost,
        shippingCosts: {
            fcl: fclCost,
            flexi: flexiCost,
            iso: isoCost
        }
    };
    
    if (editId) {
        // 編集モード
        const index = products.findIndex(function(p) { return p.id == editId; });
        if (index !== -1) {
            products[index] = Object.assign(products[index], productData);
        }
    } else {
        // 新規追加モード
        const newProduct = Object.assign({
            id: Date.now()
        }, productData);
        products.push(newProduct);
    }
    
    saveProducts();
    displayEditableProducts();
    populateProductSelect();
    clearForm();
}

function editProduct(id) {
    const product = products.find(function(p) { return p.id === id; });
    if (!product) return;
    
    // フォームに値を設定（原料費は元の入力値を使用）
    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('new-product-name').value = product.name;
    document.getElementById('new-raw-cost').value = product.rawCostOriginal || 
        (product.rawCost * 1000 * exchangeRates.usdToRmb).toFixed(2);
    document.getElementById('new-variable-cost').value = product.variableCost;
    document.getElementById('new-container-cost').value = product.containerCost;
    document.getElementById('new-fcl-cost').value = product.shippingCosts.fcl;
    document.getElementById('new-flexi-cost').value = product.shippingCosts.flexi;
    document.getElementById('new-iso-cost').value = product.shippingCosts.iso;
    
    // 変換後の値を表示
    updateRawCostConversion();
    
    // UIを編集モードに変更
    document.getElementById('form-title').textContent = '製品編集';
    document.getElementById('save-btn').textContent = '更新';
    document.getElementById('cancel-btn').style.display = 'block';
}

function cancelEdit() {
    clearForm();
}

function clearForm() {
    // フォームのクリア
    document.getElementById('edit-product-id').value = '';
    document.getElementById('new-product-name').value = '';
    document.getElementById('new-raw-cost').value = '';
    document.getElementById('new-variable-cost').value = '';
    document.getElementById('new-container-cost').value = '';
    document.getElementById('new-fcl-cost').value = '';
    document.getElementById('new-flexi-cost').value = '';
    document.getElementById('new-iso-cost').value = '';
    
    // 変換表示もクリア
    const convertedElement = document.getElementById('raw-cost-converted');
    if (convertedElement) {
        convertedElement.textContent = '= $0.00/kg (USD)';
    }
    
    // UIを追加モードに戻す
    document.getElementById('form-title').textContent = '新製品追加';
    document.getElementById('save-btn').textContent = '製品追加';
    document.getElementById('cancel-btn').style.display = 'none';
}

function displayProducts() {
    const container = document.getElementById('products-table');
    if (!container) return;
    
    let html = '<div class="product-row product-header"><div>製品名</div><div>原料費</div><div>変動費($/kg)</div><div>容器費($/kg)</div><div>輸送形態別運賃</div><div>操作</div></div>';
    
    products.forEach(function(product) {
        const shippingInfo = 'FCL(' + shippingQuantities.fcl + 'kg): $' + product.shippingCosts.fcl.toFixed(2) + '<br>Flexi(' + shippingQuantities.flexi + 'kg): $' + product.shippingCosts.flexi.toFixed(2) + '<br>ISO(' + shippingQuantities.iso + 'kg): $' + product.shippingCosts.iso.toFixed(2);
        
        const rawCostDisplay = (product.rawCostOriginal ? parseFloat(product.rawCostOriginal).toFixed(2) : '-') + ' RMB/トン<br><small>($' + product.rawCost.toFixed(4) + '/kg)</small>';
        
        html += '<div class="product-row"><div>' + product.name + '</div><div class="raw-cost-display">' + rawCostDisplay + '</div><div>$' + product.variableCost.toFixed(4) + '</div><div>$' + product.containerCost.toFixed(4) + '</div><div class="shipping-costs-display">' + shippingInfo + '</div><div class="action-buttons"><button class="edit-btn" onclick="editProduct(' + product.id + ')">編集</button><button class="delete-btn" onclick="deleteProduct(' + product.id + ')">削除</button></div></div>';
    });
    
    container.innerHTML = html;
}

function deleteProduct(id) {
    if (confirm('この製品を削除しますか？')) {
        products = products.filter(function(p) { return p.id !== id; });
        saveProducts();
        displayProducts();
        populateProductSelect();
    }
}

// デバッグ関数
function debugInfo() {
    console.log('=== デバッグ情報 ===');
    console.log('製品配列:', products);
    console.log('製品数:', products.length);
    console.log('テーブルボディ要素:', document.getElementById('editable-products-body'));
    console.log('addNewProduct関数:', typeof addNewProduct);
    console.log('displayEditableProducts関数:', typeof displayEditableProducts);
    console.log('==================');
    
    // 強制的にテーブルを再描画
    displayEditableProducts();
}
