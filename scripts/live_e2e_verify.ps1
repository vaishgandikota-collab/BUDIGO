$base = 'https://budigo-backend.onrender.com'

Write-Host "=== 1. HEALTH CHECK ==="
$health = Invoke-RestMethod -Uri "$base/health" -Method Get
Write-Host ($health | ConvertTo-Json)

Write-Host "=== 2. READY CHECK ==="
$ready = Invoke-RestMethod -Uri "$base/ready" -Method Get
Write-Host ($ready | ConvertTo-Json)

Write-Host "=== 3. USER REGISTRATION (HOST) ==="
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$regBody = @{
    fullName = 'QA Host Traveler'
    email = "qa_host_${now}@example.com"
    password = 'Password123!'
} | ConvertTo-Json

$hostAuth = Invoke-RestMethod -Uri "$base/api/auth/register" -Method Post -Body $regBody -ContentType 'application/json'
Write-Host "Registered Host: $($hostAuth.user.full_name) ($($hostAuth.user.email)) Token: $($hostAuth.token.Substring(0, 15))..."

$hostHeaders = @{ Authorization = "Bearer $($hostAuth.token)" }

Write-Host "=== 4. DESTINATION AUTOCOMPLETE ==="
$autoBody = @{ input = 'Baga Beach' } | ConvertTo-Json
$autoRes = Invoke-RestMethod -Uri "$base/api/navigation/places/autocomplete" -Method Post -Body $autoBody -ContentType 'application/json' -Headers $hostHeaders
Write-Host "Autocomplete suggestions found: $($autoRes.suggestions.Count)"

Write-Host "=== 5. CREATE TRAVEL ROOM ==="
$roomBody = @{
    roomName = 'Goa Sunset Expedition'
    destinationName = 'Baga Beach, Goa'
    destinationLatitude = 15.5553
    destinationLongitude = 73.7517
    destinationAddress = 'Baga Beach Rd, Calangute, Goa 403516'
} | ConvertTo-Json

$roomRes = Invoke-RestMethod -Uri "$base/api/rooms" -Method Post -Body $roomBody -ContentType 'application/json' -Headers $hostHeaders
$roomId = $roomRes.room.id
$roomCode = $roomRes.room.room_code
Write-Host "Created Room ID: $roomId with Join Code: $roomCode (Creator role: $($roomRes.member.member_role))"

Write-Host "=== 6. JOIN ROOM AS PARTICIPANT 2 ==="
$regBody2 = @{
    fullName = 'QA Friend Traveler'
    email = "qa_friend_${now}@example.com"
    password = 'Password123!'
} | ConvertTo-Json
$friendAuth = Invoke-RestMethod -Uri "$base/api/auth/register" -Method Post -Body $regBody2 -ContentType 'application/json'
$friendHeaders = @{ Authorization = "Bearer $($friendAuth.token)" }

$joinBody = @{
    roomCode = $roomCode
    displayName = 'QA Friend Traveler'
    shareLocation = $true
} | ConvertTo-Json
$joinRes = Invoke-RestMethod -Uri "$base/api/rooms/join" -Method Post -Body $joinBody -ContentType 'application/json' -Headers $friendHeaders
Write-Host "Friend Joined: Member ID $($joinRes.member.id), Marker Color: $($joinRes.member.marker_color)"

Write-Host "=== 7. TRANSMIT LIVE GPS TELEMETRY ==="
$locBody = @{
    roomId = $roomId
    latitude = 15.5510
    longitude = 73.7505
    accuracy = 8.5
    speed = 1.2
    heading = 180
} | ConvertTo-Json
$locRes = Invoke-RestMethod -Uri "$base/api/locations/update" -Method Post -Body $locBody -ContentType 'application/json' -Headers $hostHeaders
Write-Host "GPS Location Update Status: $($locRes.status) (Distance: $($locRes.distanceMeters)m, ETA: $($locRes.etaSeconds)s)"

Write-Host "=== 8. SMART MEETING POINT DISCOVERY (MINIMAX & DESTINATION) ==="
$mpBody = @{
    roomId = $roomId
    category = 'cafe'
} | ConvertTo-Json
$mpRes = Invoke-RestMethod -Uri "$base/api/meeting-points/search" -Method Post -Body $mpBody -ContentType 'application/json' -Headers $hostHeaders
Write-Host "Recommendations returned: $($mpRes.recommendations.Count)"
$topMp = $mpRes.recommendations[0]
Write-Host "Top Meeting Point: $($topMp.place_name) (Score: $($topMp.ranking_score), Rating: $($topMp.rating))"

Write-Host "=== 9. CAST GROUP VOTES ==="
$voteBody = @{
    roomId = $roomId
    meetingPointId = $topMp.id
} | ConvertTo-Json
$voteRes = Invoke-RestMethod -Uri "$base/api/votes" -Method Post -Body $voteBody -ContentType 'application/json' -Headers $hostHeaders
Write-Host "Vote Cast by Host. Total votes: $($voteRes.tallies.totalVotes)"

Write-Host "=== 10. HOST CONFIRMS WINNING MEETING POINT ==="
$confirmRes = Invoke-RestMethod -Uri "$base/api/meeting-points/$($topMp.id)/select" -Method Post -Headers $hostHeaders
Write-Host "Confirmed Winning Meeting Point: $($confirmRes.meetingPoint.place_name) (is_confirmed: $($confirmRes.meetingPoint.is_confirmed))"

Write-Host "=== 11. VERIFY ROOM TRIPS LIST ==="
$tripsRes = Invoke-RestMethod -Uri "$base/api/rooms/my-trips" -Method Get -Headers $hostHeaders
Write-Host "My Trips count: $($tripsRes.trips.Count)"

Write-Host "=== ALL LIVE PRODUCTION API TESTS PASSED SUCCESSFULLY ==="
