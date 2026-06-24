// In-memory storage for the hackathon demo
const messagesStore: Record<string, any[]> = {};
const ticketsStore: any[] = [];

export async function saveMessage({ sessionId, role, content }: { sessionId: string, role: string, content: string }) {
    if (!messagesStore[sessionId]) {
        messagesStore[sessionId] = [];
    }
    messagesStore[sessionId].push({ role, content, timestamp: new Date().toISOString() });
    return true;
}

export async function getConversationHistory(sessionId: string) {
    return messagesStore[sessionId] || [];
}

export async function createTicket(ticketData: any) {
    const ticket = {
        id: `TKT-${Math.floor(Math.random() * 10000)}`,
        ...ticketData,
        status: 'open',
        createdAt: new Date().toISOString()
    };
    ticketsStore.push(ticket);
    return ticket;
}

export async function getAllTickets() {
    return ticketsStore;
}