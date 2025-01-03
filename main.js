const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const Firebird = require('node-firebird');


// Configuración de Firebird
const dbOptions = {
  host: '127.0.0.1',
  port: 3050,
  database: 'C:/winfarma/data/winfarma',
  user: 'SYSDBA',
  password: '.',
  lowercase_keys: false,
  role: null,
  pageSize: 4096
};


function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Crear el menú personalizado
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R', // Puedes cambiar el atajo de teclado si lo deseas
          click: () => {
            win.reload();
          },
        },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q', // Puedes cambiar el atajo de teclado si lo deseas
          click: () => {
            app.quit();
          },
        },
      ],
    },
  ]);

  // Cambiar el menú superior
  win.setMenu(menu);
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Función para ejecutar consultas
function executeQuery(query, params, callback) {
  Firebird.attach(dbOptions, (err, db) => {
    if (err) throw err;
    db.query(query, params, (err, result) => {
      if (err) throw err;
      callback(result);
      db.detach();
    });
  });
}

ipcMain.handle('check-mandataria', async () => {
  return new Promise((resolve, reject) => {
    const checkQuery = `SELECT COUNT(*) FROM MANDATARIAS WHERE DESCRIPCION = 'PARACELSO'`;
    executeQuery(checkQuery, [], (result) => {
      resolve(result[0].COUNT > 0);
    });
  });
});

ipcMain.handle('check-entidad', async () => {
  return new Promise((resolve, reject) => {
    const checkQuery = `SELECT COUNT(*) FROM ENTIDADES WHERE DESCRIPCION = 'MEDICOS PARACELSO'`;
    executeQuery(checkQuery, [], (result) => {
      resolve(result[0].COUNT > 0);
    });
  });
});

ipcMain.handle('add-mandataria', async () => {
  return new Promise((resolve, reject) => {
    const checkQuery = `SELECT COUNT(*) FROM MANDATARIAS WHERE DESCRIPCION = 'PARACELSO'`;
    executeQuery(checkQuery, [], (result) => {
      if (result[0].COUNT === 0) {
        const insertQuery = `
          INSERT INTO MANDATARIAS (ID, DESCRIPCION)
          VALUES ((SELECT COALESCE(MAX(ID), 0) + 1 FROM MANDATARIAS), 'PARACELSO')
        `;
        executeQuery(insertQuery, [], () => {
          resolve(false);
        });
      } else {
        resolve(true);
      }
    });
  });
});

ipcMain.handle('add-entidad', async () => {
  return new Promise((resolve, reject) => {
    const checkQuery = `SELECT COUNT(*) FROM ENTIDADES WHERE DESCRIPCION = 'MEDICOS PARACELSO'`;
    executeQuery(checkQuery, [], (result) => {
      if (result[0].COUNT === 0) {
        const insertQuery = `
          INSERT INTO ENTIDADES (ID, DESCRIPCION, MANDATARIA)
          VALUES (
            (SELECT COALESCE(MAX(ID), 0) + 1 FROM ENTIDADES),
            'MEDICOS PARACELSO',
            (SELECT ID FROM MANDATARIAS WHERE DESCRIPCION = 'PARACELSO')
          )
        `;
        executeQuery(insertQuery, [], () => {
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  });
});



ipcMain.handle('add-medico', async (event, medicoNombre, porcentajePorDefecto) => {
  medicoNombre = medicoNombre.toUpperCase();
  return new Promise((resolve, reject) => {
    const checkMedicoQuery = `SELECT COUNT(*) FROM CO_MAESTRO WHERE DESCRIPCION = ?`;
    executeQuery(checkMedicoQuery, [medicoNombre], (result) => {
      if (result[0].COUNT === 0) {
        const checkMandatariaQuery = `SELECT COUNT(*) FROM MANDATARIAS WHERE DESCRIPCION = 'PARACELSO'`;
        executeQuery(checkMandatariaQuery, [], (mandatariaResult) => {
          if (mandatariaResult[0].COUNT > 0) {
            const checkEntidadQuery = `SELECT COUNT(*) FROM ENTIDADES WHERE DESCRIPCION = 'MEDICOS PARACELSO'`;
            executeQuery(checkEntidadQuery, [], (entidadResult) => {
              if (entidadResult[0].COUNT > 0) {
                const insertMedicoQuery = `
                  INSERT INTO CO_MAESTRO (ID, DESCRIPCION, MUESTRAAYUDA)
                  VALUES ((SELECT COALESCE(MAX(ID), 0) + 1 FROM CO_MAESTRO), ?, 'N')
                `;
                executeQuery(insertMedicoQuery, [medicoNombre], () => {
                  // Ejecutar consultas adicionales
                  const insertDetalleQuery = `
                    INSERT INTO CO_DETALLE (CONTRATO, ENTIDAD, DESCRIPCION, CUBREVENTALIBRE, PORCENTAJEPORDEFECTO, RENGLONESCUBIERTOS, DIASVALIDEZRECETA, IDENTIDAD, FLAGS, CANTIDADTOTALPRODUCTOS)
                    VALUES ((SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 1, ?, 'S', ?, 10, 30, (SELECT ID FROM ENTIDADES WHERE DESCRIPCION = 'MEDICOS PARACELSO'), 4, 0)
                  `;
                  executeQuery(insertDetalleQuery, [medicoNombre, medicoNombre, porcentajePorDefecto], () => {
                    const insertControlCantidadesQuery = `
                      INSERT INTO CO_CONTROLCANTIDADES (CONTRATO, ENTIDAD, CONTROLCANTIDAD, CANTIDADPORRENGLON, CANTIDADPORRECETA, CANTIDADPROLONGADO)
                      SELECT 
                        (SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 
                        1, 
                        id AS CONTROLCANTIDAD, 
                        999, 
                        999, 
                        999
                      FROM 
                        controlcantidades
                    `;
                    executeQuery(insertControlCantidadesQuery, [medicoNombre], () => {
                      // Consultas individuales para CO_LIQADICIONAL
                      const insertLiqAdicionalQueries = [
                        `INSERT INTO CO_LIQADICIONAL (CONTRATO, ENTIDAD, DATOREQUERIDO, FLAGS) VALUES ((SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 1, 'NUMERO AFILIADO', 0)`,
                        `INSERT INTO CO_LIQADICIONAL (CONTRATO, ENTIDAD, DATOREQUERIDO, FLAGS) VALUES ((SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 1, 'NOMBRE AFILIADO', 0)`,
                        `INSERT INTO CO_LIQADICIONAL (CONTRATO, ENTIDAD, DATOREQUERIDO, FLAGS) VALUES ((SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 1, 'APELLIDO AFILIADO', 0)`,
                        `INSERT INTO CO_LIQADICIONAL (CONTRATO, ENTIDAD, DATOREQUERIDO, FLAGS) VALUES ((SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 1, 'NOMBRE MEDICO', 0)`,
                        `INSERT INTO CO_LIQADICIONAL (CONTRATO, ENTIDAD, DATOREQUERIDO, FLAGS) VALUES ((SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 1, 'NUMERO MATRICULA', 0)`,
                        `INSERT INTO CO_LIQADICIONAL (CONTRATO, ENTIDAD, DATOREQUERIDO, FLAGS) VALUES ((SELECT ID FROM CO_MAESTRO WHERE DESCRIPCION = ?), 1, 'TIPO MATRICULA', 0)`
                      ];

                      let completedQueries = 0;
                      insertLiqAdicionalQueries.forEach((query) => {
                        executeQuery(query, [medicoNombre], () => {
                          completedQueries++;
                          if (completedQueries === insertLiqAdicionalQueries.length) {
                            resolve(true);
                          }
                        });
                      });
                    });
                  });
                });
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        });
      } else {
        resolve(false);
      }
    });
  });
})
