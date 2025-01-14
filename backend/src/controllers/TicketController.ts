import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import formatBody from "../helpers/Mustache";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import ShowUserService from "../services/UserServices/ShowUserService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  transf: boolean;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;

  let queueIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    userId,
    queueIds,
    withUnreadMessages
  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId,queueId }: TicketData = req.body;

  try {
  const ticket = await CreateTicketService({ 
    contactId,
    status,
    userId,
    queueId});

  const io = getIO();
  io.to(ticket.status).emit("ticket", {
    action: "update",
    ticket,
    queueId
  });

  return res.status(200).json(ticket);
}catch (error) {
  // Lide com os erros adequadamente
  console.error(error);
  return res.status(500).json({ error: "Erro interno do servidor" });
}
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;

  const contact = await ShowTicketService(ticketId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;

  // Obter o antigo atendente
  const ticketShow = await ShowTicketService(ticketId);

  // Atualiza o ticket para os parametros novos (usuario, fila...)
  const { ticket } = await UpdateTicketService({ ticketData, ticketId });

  if (ticketData.transf) {
    // if (ticketShow.userId !== ticketData.userId && ticketShow.queueId === ticketData.queueId) {
    //   // const nomeAntigo = await ShowUserService(ticketShow.userId);
    //   const nome = await ShowUserService(ticketData.userId);
    //   const msgtxt = "➡️ Sua mensagem foi transferida para o setor: *"+name+"* \n \n➡️ Você será atendito por: *"+nome.name+"*";
    //   await SendWhatsAppMessage({ body: msgtxt, ticket });
    // } else
    if (ticketData.userId) {
      const { name } = await ShowQueueService(ticketData.queueId);
      const nome = await ShowUserService(ticketData.userId);
      const msgtxt = "➡️ Sua mensagem foi transferida para o setor: *"+name+"* \n \n➡️ Você será atendito por: *"+nome.name+"*";
      await SendWhatsAppMessage({ body: msgtxt, ticket });
    }
    else {
      const { name } = await ShowQueueService(ticketData.queueId);
      const nome = await ShowUserService(ticketData.userId);
      const msgtxt = "➡️ Sua mensagem foi transferida para o setor: *"+name+"* \n \n➡️ Você será atendito por: *"+nome.name+"*";
      await SendWhatsAppMessage({ body: msgtxt, ticket });
    }
  }


  if (ticket.status === "closed") {
    const whatsapp = await ShowWhatsAppService(ticket.whatsappId);

    const { farewellMessage } = whatsapp;

    if (farewellMessage) {
      await SendWhatsAppMessage({
        body: formatBody(farewellMessage, ticket.contact),
        ticket
      });
    }
  }

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  const ticket = await DeleteTicketService(ticketId);

  const io = getIO();
  io.to(ticket.status)
    .to(ticketId)
    .to("notification")
    .emit("ticket", {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};
