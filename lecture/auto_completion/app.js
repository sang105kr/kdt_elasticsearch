document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('campingSearch');
    const autocompleteList = document.getElementById('autocompleteList');
    // 인덱스 이름을 camping4로 변경하셨으므로 URL도 camping4로 맞춥니다.
    const ELASTICSEARCH_URL = 'http://localhost:9200/camping4/_search'; 

    let currentHighlight = -1; // 현재 하이라이트된 항목의 인덱스
    let suggestions = []; // 현재 표시되는 제안 목록

    // 검색창에 입력이 있을 때마다 자동완성 요청
    searchInput.addEventListener('input', debounce(handleInput, 300));

    // 키보드 이벤트 처리 (상하 방향키, Enter)
    searchInput.addEventListener('keydown', handleKeydown);

    // 문서 클릭 시 자동완성 목록 숨김
    document.addEventListener('click', (event) => {
        if (!autocompleteList.contains(event.target) && event.target !== searchInput) {
            hideAutocompleteList();
        }
    });

    /**
     * 입력 이벤트를 처리하고 Elasticsearch에 검색 요청을 보냅니다.
     * 이번 버전은 `multi_match` 쿼리를 사용하여 검색 결과와 하이라이팅을 함께 가져옵니다.
     */
    async function handleInput() {
        const query = searchInput.value.trim();

        if (query.length < 2) { // 2글자 미만일 경우 요청 보내지 않음
            hideAutocompleteList();
            return;
        }

        try {
            const response = await fetch(ELASTICSEARCH_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "query": {
                        "multi_match": {
                            "query": query, // 사용자의 입력 값을 쿼리로 사용
                            "fuzziness": "AUTO", // 오타 보정 (선택 사항, 필요에 따라 조정)
                            "type": "bool_prefix", // 접두사 매칭
                            "fields": [
                                "name" // `name` 필드에 대해 검색 (n-gram 필드는 `search_as_you_type` 사용 시 자동 처리)
                            ]
                        }
                    },
                    "highlight": {
                        "pre_tags": ["<strong style='color:red'>"],
                        "post_tags": ["</strong>"],
                        "fields": {
                            "name": {
                                "number_of_fragments": 0 // 전체 필드를 하이라이트하기 위해 조각화하지 않음
                            }
                        }
                    },
                    "size": 10 // 최대 10개 결과 반환
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Elasticsearch query failed:', errorData);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Elasticsearch Response:', data); // 응답 확인용

            // hits에서 결과와 하이라이팅 데이터를 추출하여 표시
            displayAutocompleteResults(data.hits.hits);

        } catch (error) {
            console.error('Error fetching autocomplete suggestions:', error);
            hideAutocompleteList();
        }
    }

    /**
     * 자동완성 결과를 화면에 표시합니다.
     * @param {Array} hits - Elasticsearch에서 반환된 검색 결과 (hits).
     */
    function displayAutocompleteResults(hits) {
        autocompleteList.innerHTML = ''; // 기존 목록 초기화
        suggestions = []; // 제안 목록 초기화
        currentHighlight = -1; // 하이라이트 초기화

        if (hits && hits.length > 0) {
            hits.forEach((hit) => {
                const li = document.createElement('li');
                // 하이라이팅된 텍스트가 있으면 그것을 사용하고, 없으면 원본 필드 사용
                const highlightedText = hit.highlight && hit.highlight.name ? hit.highlight.name[0] : hit._source.name;
                
                li.innerHTML = highlightedText; // innerHTML을 사용하여 HTML 태그를 렌더링
                li.dataset.value = hit._source.name; // 선택 시 사용할 원본 값
                li.addEventListener('click', () => selectSuggestion(hit._source.name));
                
                autocompleteList.appendChild(li);
                suggestions.push(li); // 리스트에 추가
            });
            autocompleteList.style.display = 'block'; // 목록 표시
        } else {
            hideAutocompleteList();
        }
    }

    /**
     * 자동완성 목록을 숨깁니다.
     */
    function hideAutocompleteList() {
        autocompleteList.innerHTML = '';
        autocompleteList.style.display = 'none';
        suggestions = [];
        currentHighlight = -1;
    }

    /**
     * 선택된 제안을 검색창에 채웁니다.
     * @param {string} value - 선택된 제안 값.
     */
    function selectSuggestion(value) {
        searchInput.value = value;
        hideAutocompleteList();
        // 실제 검색을 수행하는 함수를 여기에 호출할 수 있습니다.
        console.log(`"${value}" 검색 시작`);
        // 예: searchCamping(value);
    }

    /**
     * 키보드 이벤트 핸들러
     * @param {KeyboardEvent} event
     */
    function handleKeydown(event) {
        if (suggestions.length === 0) return;

        // 기존 하이라이트 제거
        if (currentHighlight > -1) {
            suggestions[currentHighlight].classList.remove('highlight');
        }

        if (event.key === 'ArrowDown') {
            currentHighlight = (currentHighlight + 1) % suggestions.length;
            event.preventDefault(); // 커서가 검색창 끝으로 이동하는 것 방지
        } else if (event.key === 'ArrowUp') {
            currentHighlight = (currentHighlight - 1 + suggestions.length) % suggestions.length;
            event.preventDefault(); // 커서가 검색창 시작으로 이동하는 것 방지
        } else if (event.key === 'Enter') {
            if (currentHighlight > -1) {
                selectSuggestion(suggestions[currentHighlight].dataset.value);
            } else {
                // 하이라이트 없이 Enter 누르면 현재 입력된 텍스트로 검색
                selectSuggestion(searchInput.value);
            }
            event.preventDefault();
        } else if (event.key === 'Escape') {
            hideAutocompleteList();
        }

        // 새 항목 하이라이트
        if (currentHighlight > -1) {
            suggestions[currentHighlight].classList.add('highlight');
            // 하이라이트된 항목이 스크롤되도록 설정
            suggestions[currentHighlight].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * 디바운스 함수: 일정 시간 내에 여러 번 호출되어도 마지막 호출만 실행합니다.
     * @param {Function} func - 디바운스할 함수.
     * @param {number} delay - 지연 시간 (밀리초).
     * @returns {Function} 디바운스된 함수.
     */
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
});