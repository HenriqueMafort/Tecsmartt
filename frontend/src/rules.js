const rules = {
	user: {
		static: [],
	},

	admin: {
		static: [
			"drawer-admin-items:view",
			"tickets-manager:showall",
			"user-modal:editProfile",
			"user-modal:editQueues",
			"ticket-options:deleteTicket",
			"ticket-options:transferWhatsapp",
			"contacts-page:deleteContact",
			"tickets:showQueue",
			"notification-popOver:showall",
			
		],
	},

	gestor: {
		static: [
			"drawer-superv-items:view",
			"tickets-manager:showall",
			"tickets:showQueue",
			"notification-popOver:showall",
		],
	},
};

export default rules;
