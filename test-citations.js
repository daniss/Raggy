// Test script to verify citation display functionality
// Run this in the browser console on the assistant page

console.log('🔍 Testing citation display system...');

// Test 1: Check if citation markers use |1} format
function testCitationMarkers() {
  console.log('📍 Testing citation marker format...');
  
  // Check if citation markers exist
  const markers = document.querySelectorAll('.citation-marker');
  console.log(`Found ${markers.length} citation markers`);
  
  markers.forEach((marker, index) => {
    const text = marker.textContent;
    const isCorrectFormat = /^\|\d+\}$/.test(text);
    console.log(`Marker ${index + 1}: "${text}" - ${isCorrectFormat ? '✅ Correct' : '❌ Incorrect format'}`);
  });
}

// Test 2: Check ProminentSources integration
function testProminentSources() {
  console.log('📚 Testing ProminentSources component...');
  
  const sourcesContainer = document.querySelector('.prominent-sources');
  if (sourcesContainer) {
    console.log('✅ ProminentSources component found');
    
    // Check source numbering
    const sourceNumbers = sourcesContainer.querySelectorAll('[class*="number"]');
    console.log(`Found ${sourceNumbers.length} source numbers`);
    
    // Check if they use [1] format
    sourceNumbers.forEach((num, index) => {
      const text = num.textContent;
      const isCorrectFormat = /^\[\d+\]$/.test(text);
      console.log(`Source ${index + 1}: "${text}" - ${isCorrectFormat ? '✅ Correct' : '❌ Incorrect format'}`);
    });
  } else {
    console.log('❌ ProminentSources component not found');
  }
}

// Test 3: Check citation click interactions
function testCitationInteractions() {
  console.log('🖱️ Testing citation interactions...');
  
  const markers = document.querySelectorAll('.citation-marker');
  markers.forEach((marker, index) => {
    marker.addEventListener('click', () => {
      console.log(`🎯 Clicked citation marker ${index + 1}`);
    });
  });
  
  const sourceCards = document.querySelectorAll('.source-card');
  sourceCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      console.log(`🎯 Clicked source card ${index + 1}`);
    });
  });
}

// Test 4: Check Cobalt Daylight theme styling
function testCobaltTheme() {
  console.log('🎨 Testing Cobalt Daylight theme...');
  
  const root = document.documentElement;
  const computedStyle = getComputedStyle(root);
  
  const themeVars = [
    '--cd-bg',
    '--cd-surface',
    '--cd-accent',
    '--cd-text-primary',
    '--cd-text-secondary'
  ];
  
  themeVars.forEach(varName => {
    const value = computedStyle.getPropertyValue(varName);
    console.log(`${varName}: ${value || '❌ Not found'}`);
  });
}

// Test 5: Check streaming integration
function testStreaming() {
  console.log('🔄 Testing streaming integration...');
  
  // Simulate a test message
  const testButton = document.createElement('button');
  testButton.textContent = 'Test Citations';
  testButton.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; padding: 10px; background: #0B63E6; color: white; border: none; border-radius: 4px; cursor: pointer;';
  testButton.className = 'test-citations-btn';
  
  // Inject CSS for the test button if not already present
  if (!document.getElementById('test-citations-btn-style')) {
    const style = document.createElement('style');
    style.id = 'test-citations-btn-style';
    style.textContent = `
      .test-citations-btn {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        padding: 10px;
        background: #0B63E6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }
  testButton.addEventListener('click', () => {
    console.log('🧪 Running citation tests...');
    testCitationMarkers();
    testProminentSources();
    testCitationInteractions();
    testCobaltTheme();
  });
  
  document.body.appendChild(testButton);
  console.log('✅ Test button added to page');
}

// Run all tests
setTimeout(() => {
  testCitationMarkers();
  testProminentSources();
  testCitationInteractions();
  testCobaltTheme();
  testStreaming();
}, 1000);

console.log('🚀 Citation display system test initialized!');
