import qrCode from "qrcode-terminal";

import {Client, LocalAuth} from "whatsapp-web.js"
import { getIO } from "./socket";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { handleMessage } from "../services/WbotServices/wbotMessageListener";

interface Session extends Client {
  id?: number;
}

const sessions: Session[] = [];

const syncUnreadMessages = async (wbot: Session) => {
  const chats = await wbot.getChats();

  /* eslint-disable no-restricted-syntax */
  /* eslint-disable no-await-in-loop */
  for (const chat of chats) {
    if (chat.unreadCount > 0) {
      const unreadMessages = await chat.fetchMessages({
        limit: chat.unreadCount
      });

      for (const msg of unreadMessages) {
        await handleMessage(msg, wbot);
      }

      await chat.sendSeen();
    }
  }
};

export const initWbot = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise((resolve, reject) => {
    try {
      const io = getIO();
      const sessionName = whatsapp.name;
      let sessionCfg;

      if (whatsapp && whatsapp.session) {
        sessionCfg = JSON.parse(whatsapp.session);
      }

      const args:String = process.env.CHROME_ARGS || "";

// const wbot: Session = new Client({
// session: sessionCfg,
// authStrategy: new LocalAuth({
// dataPath: "sessions",
// }),
// webVersionCache: {
// type: 'remote',
// remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html',
// },
// puppeteer: {
// executablePath: process.env.CHROME_BIN || undefined,
// // @ts-ignore
// browserWSEndpoint: process.env.CHROME_WS || undefined,
// //args: args.split(' ')
// args: ["--no-sandbox", "--disable-setuid-sandbox"]
// }
// });

      const wbot: Session = new Client({
      session: sessionCfg,
      authStrategy: new LocalAuth({clientId: 'bd_'+whatsapp.id}),
      puppeteer: {
      executablePath: process.env.CHROME_BIN || undefined,
      // @ts-ignore
      browserWSEndpoint: process.env.CHROME_WS || undefined,
      args: args.split(' ')
      },
});
      wbot.initialize();

      wbot.on("qr", async qr => {
        logger.info("Session:", sessionName);
        qrCode.generate(qr, { small: true });
        await whatsapp.update({ qrcode: qr, status: "qrcode", retries: 0 });

        const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
        if (sessionIndex === -1) {
          wbot.id = whatsapp.id;
          sessions.push(wbot);
        }

        io.emit("whatsappSession", {
          action: "update",
          session: whatsapp
        });
      });

      wbot.on("authenticated", async session => {
        logger.info(`Session: ${sessionName} AUTHENTICATED`);
      });

      wbot.on("auth_failure", async msg => {
        console.error(
          `Session: ${sessionName} AUTHENTICATION FAILURE! Reason: ${msg}`
        );

        if (whatsapp.retries > 1) {
          await whatsapp.update({ session: "", retries: 0 });
        }

        const retry = whatsapp.retries;
        await whatsapp.update({
          status: "DISCONNECTED",
          retries: retry + 1
        });

        io.emit("whatsappSession", {
          action: "update",
          session: whatsapp
        });

        reject(new Error("Error starting whatsapp session."));
      });

      wbot.on("ready", async () => {
        logger.info(`Session: ${sessionName} READY`);

        await whatsapp.update({
          status: "CONNECTED",
          qrcode: "",
          retries: 0
        });

        io.emit("whatsappSession", {
          action: "update",
          session: whatsapp
        });

        const sessionIndex = sessions.findIndex(s => s.id === whatsapp.id);
        if (sessionIndex === -1) {
          wbot.id = whatsapp.id;
          sessions.push(wbot);
        }

        wbot.sendPresenceAvailable();
        await syncUnreadMessages(wbot);

        resolve(wbot);
      });

      //Mensagem automatica de atendimento fora do horário
      /*wbot.on('message', async msg => {
        if(msg.from === "status@broadcast"){
          return true;
        }

        function delay(t: number, v:any): Promise<any> {
          return new Promise(function(resolve) { 
              setTimeout(resolve.bind(null, v), t);
          });
      }
      wbot.sendPresenceAvailable();
      const date = new Date();
      const seconds = 0;
      const minutes = date.getMinutes();
      const hour = date.getHours()*60;
      const atendimentoTEC = hour+minutes+seconds;
      const inicioAtendimentoTEC = 462;
      const inicioIntervaloAtendimentoTEC = 720;
      const terminoIntervaloAtendimentoTEC = 810;
      const terminoAtendimentoTEC = 1080;
      if (date.getDay() ==0 || date.getDay() ==6)
      {
      msg.reply ("Prezado Cliente, nosso atendimento é de Segunda a Sexta das 08:00 - 12:00 as 13:30 - 18:00. Agradecemos seu contato (mensagem automática)");
      }
     else if (atendimentoTEC >= inicioIntervaloAtendimentoTEC && atendimentoTEC <= terminoIntervaloAtendimentoTEC)
      {
      msg.reply("Prezado Cliente, nosso atendimento é de Segunda a Sexta das 08:00 - 12:00 as 13:30 - 18:00. Agradecemos seu contato (mensagem automática)");
      }
      else if (atendimentoTEC >= inicioAtendimentoTEC && atendimentoTEC <= terminoAtendimentoTEC){
          console.log("Dentro do horário de atendimento");
      }
      else {
          console.log("Fora do horário de atendimento");
          delay(10000, null).then(function() {
              msg.reply("Prezado Cliente, nosso atendimento é de Segunda a Sexta das 08:00 - 12:00 as 13:30 - 18:00. Agradecemos seu contato (mensagem automática)");
            });  
        }

      });*/
    
    } catch (err) {
      logger.error('err');
    }
  });
};

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }
  return sessions[sessionIndex];
};

export const removeWbot = (whatsappId: number): void => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      sessions[sessionIndex].destroy();
      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error('err');
  }
};
