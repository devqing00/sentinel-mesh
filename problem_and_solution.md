Sentinel Mesh: Bridging the 1% Gap in Pandemic Response

A narrative overview of the Sentinel Mesh System.

The Public Health Crisis: The Latency Gap

In epidemiology, time is the ultimate currency. During an outbreak of a highly infectious pathogen—like Lassa fever, Ebola, or a novel respiratory virus—the current public health infrastructure operates with a massive "latency gap."

We rely on syndromic surveillance. This means health authorities only realize an outbreak is occurring after patients become severely ill, travel to a clinical facility, and get tested. By the time the Nigerian Centre for Disease Control (NCDC) or local LGA health officers receive a confirmed report, the patient has already been contagious for days. They have moved through markets, ridden public transit, and interacted with their community.

When manual contact tracing finally begins, it is slow and subjective. Investigators ask patients: "Who were you near for the last two weeks?" In bustling urban centers or tight-knit rural communities, remembering the faces of everyone on a transit bus is impossible. By the time the data is gathered and entered into national systems like SORMAS (Surveillance Outbreak Response Management and Analysis System), the virus has already moved three steps ahead.

The Sentinel Mesh Innovation

Sentinel Mesh was designed to completely eliminate this latency gap. We shift disease surveillance from a reactive system that chases outbreaks, to a proactive, automated early-warning radar.

The system utilizes low-cost "Tracy" IoT wearables. These devices act as a mesh network, silently logging anonymized Bluetooth handshakes (who was near whom) and GPS locations (where they were).

Solving the "1% Vitals Gap"

A core challenge of IoT health monitoring in low-resource environments is battery life. Continuous temperature and heart rate scanning drains batteries rapidly. Therefore, our system is designed around a critical reality: Vitals data is sparse, representing only about 1% of the total recorded data.

Instead of viewing this as a flaw, Sentinel Mesh leverages it. We do not need continuous health data from everyone. We only need one anomaly to trigger the intelligence engine. When a device records a spike in surface temperature (>38°C) or heart rate, the system's AI steps in. It takes that single anomalous reading, looks at the device's mobility trail, and maps it to a specific community "geohash." It then cross-references the contact logs to see how many people that anomalous device recently interacted with.

From a mere 1% data sliver, the system mathematically calculates a comprehensive "Community Risk Score."

The Automated Agency Pipeline (Trust and Action)

Data without action is useless. The true power of Sentinel Mesh is its automated pipeline.

When a community risk score crosses a critical threshold, Sentinel Mesh doesn't just update a dashboard—it takes action.

It automatically formats the exposure data into a payload compatible with the NCDC's eIDSR/SORMAS system.

It uses generative AI to instantly translate community alerts into English, Yoruba, Hausa, Igbo, and Pidgin.

It automatically dispatches an email or SMS notification directly to the relevant agency or health officer.

Establishing Trust

In public health, automated AI decisions can breed mistrust. Sentinel Mesh includes a strict Audit and Explainability Layer. Every single time an automated notification is fired to an agency, it is logged. A dashboard allows human operators to click on an alert and see exactly why the AI triggered it: "Notification sent because Device U023 registered 38.5°C at Geohash s1kedn1tq, and had 14 secondary contacts in the last 48 hours." Furthermore, devices operate on a strict "opt-in" basis, ensuring community consent is baked into the code.

Sentinel Mesh doesn't just collect data; it connects the dots, translates the threat, and notifies the authorities—all before the first patient even reaches the hospital doors.