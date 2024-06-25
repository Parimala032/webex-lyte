let webex;
let accessToken;
let ongoingMeetingListElement;
let upcomingMeetingListElement;
let meetingDetailsElement;
const redirectUri = window.location.origin;
const scope = 'spark:all meeting:schedules_read';

// Function to format date to ISO string with timezone offset
function toISOStringWithOffset(date) {
    const tzo = -date.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function(num) {
            return (num < 10 ? '0' : '') + num;
        };
  
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        dif + pad(Math.floor(Math.abs(tzo) / 60)) +
        ':' + pad(Math.abs(tzo % 60));
}

// Get current date and the end of the day
const now = new Date();
const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

// Format dates to ISO strings with timezone offsets
const fromDate = toISOStringWithOffset(startOfDay);
const toDate = toISOStringWithOffset(endOfDay);

const apiUrl = `https://webexapis.com/v1/meetings?meetingType=scheduledMeeting&from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;

// Function to set a cookie
function setCookie(name, value, hours) {
    const d = new Date();
    d.setTime(d.getTime() + (hours * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

// Function to get a cookie by name
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

// Function to check if a cookie exists
function checkCookie(name) {
    const cookie = getCookie(name);
    return cookie !== null;
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// Initialize OAuth with Webex SDK
function initOauth() {
    if (checkCookie('access_token')) {
        accessToken = getCookie('access_token');
        showMeetingContainer();
        fetchMeetings();
    } else {
        webex = window.webex = Webex.init({
            config: {
                appName: 'Webex Meetings App',
                appPlatform: 'web',
                credentials: {
                    client_id: 'Ca99a9ffb2e619475b9d66ad50a213586223e5cd9089579f47f63487b590afe4c',
                    redirect_uri: redirectUri,
                    scope: scope
                }
            }
        });

        webex.once('ready', () => {
            if (webex.canAuthorize) {
                accessToken = webex.credentials.supertoken.access_token;
                setCookie('access_token', accessToken, 24); 
                showMeetingContainer();
                fetchMeetings();
            } else {
                redirectToLogin();
            }
        });
    }
}

function redirectToLogin() {
    webex.authorization.initiateLogin();
}

function showMeetingContainer() {
    const loginContainer = document.querySelector('.login-container');
    const meetingContainer = document.getElementById('meeting-container');
    if (loginContainer) {
        loginContainer.style.display = 'none';
    }
    if (meetingContainer) {
        meetingContainer.style.display = 'block';
    }
}

// Fetch Meetings with OAuth Token
async function fetchMeetings() {
    try {
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        console.log('API Response:', data); // Log the full response

        if (Array.isArray(data.items)) {
            displayOngoingMeetings(data.items);
            displayUpcomingMeetings(data.items);
        } else {
            throw new Error("Received data is not an array");
        }
    } catch (error) {
        console.error('Error fetching meetings:', error);
        ongoingMeetingListElement.innerHTML = '<p>Failed to load ongoing meetings. Please try again later.</p>';
        upcomingMeetingListElement.innerHTML = '<p>Failed to load upcoming meetings. Please try again later.</p>';
    }
}

// Display meeting details
function displayMeetingDetails(meeting) {
    meetingDetailsElement.innerHTML = ''; // Clear previous details

    const detailsHTML = `
        <p><strong style="color:#00aaff;">Meeting Title</strong></p>
        <p>${meeting.title}</p>
        <p><strong style="color:#00aaff;">Meeting Link</strong></p>
        <p>${meeting.webLink}</p>
        <p><strong style="color:#00aaff">Meeting Number</strong></p>
        <p>${meeting.meetingNumber}</p>
        <p><strong style="color:#00aaff">Host Key</strong></p>
        <p>${meeting.hostKey}</p>
        <p><strong style="color:#00aaff">Password</strong></p>
        <p>${meeting.password}</p>
        <p><strong style="color:#00aaff">Access Code</strong></p>
        <p>${meeting.telephony.accessCode}</p>
        <p><strong style="color:#00aaff">Sip Address</strong></p>
        <p>${meeting.sipAddress}<p/>
    `;
    meetingDetailsElement.innerHTML = detailsHTML;

    const joinButton = document.createElement('button');
    joinButton.innerText = 'Join Meeting';
    joinButton.classList.add('btn', 'join-btn');
    joinButton.onclick = () => window.open(meeting.webLink, '_blank');
    meetingDetailsElement.appendChild(joinButton);
}

// Create meeting list
function createMeetingList(meetings, filterFn, listElement, emptyMessage) {
    const filteredMeetings = meetings.filter(filterFn);

    if (filteredMeetings.length === 0) {
        listElement.innerHTML = `<p>${emptyMessage}</p>`;
        return;
    }

    listElement.innerHTML = '';

    filteredMeetings.forEach(meeting => {
        const meetingElement = document.createElement('div');
        meetingElement.classList.add('meeting');

        meetingElement.onclick = () => displayMeetingDetails(meeting);

        const meetingTitle = document.createElement('h2');
        meetingTitle.textContent = meeting.title || 'No title provided';
        meetingElement.appendChild(meetingTitle);

        const meetingDate = document.createElement('p');
        meetingDate.textContent = `Date: ${new Date(meeting.start).toLocaleString()}`;
        meetingElement.appendChild(meetingDate);

        const meetingOrganizer = document.createElement('p');
        meetingOrganizer.textContent = `Organizer: ${meeting.hostDisplayName || 'Unknown'}`;
        meetingElement.appendChild(meetingOrganizer);

        listElement.appendChild(meetingElement);
    });
}

// Display ongoing meetings
function displayOngoingMeetings(meetings) {
    const now = new Date();
    createMeetingList(
        meetings,
        meeting => {
            const start = new Date(meeting.start);
            const end = new Date(meeting.end);
            return start <= now && now <= end;
        },
        ongoingMeetingListElement,
        'No current meetings found.'
    );
}

// Display upcoming meetings
function displayUpcomingMeetings(meetings) {
    const now = new Date();
    createMeetingList(
        meetings,
        meeting => new Date(meeting.start) > now,
        upcomingMeetingListElement,
        'No upcoming meetings found.'
    );
}

// DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', () => {
    ongoingMeetingListElement = document.getElementById('ongoing-meeting-list');
    upcomingMeetingListElement = document.getElementById('upcoming-meeting-list');
    meetingDetailsElement = document.getElementById('meeting-details');
    initOauth(); 
});
